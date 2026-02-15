require('dotenv').config();
const { Client } = require('@notionhq/client');
const fs = require('fs');
const path = require('path');

// Trim credentials
const apiKey = process.env.NOTION_API_KEY ? process.env.NOTION_API_KEY.trim() : '';
const databaseIdRaw = process.env.NOTION_DATABASE_ID ? process.env.NOTION_DATABASE_ID.trim() : '';

const notion = new Client({ auth: apiKey });

// Format UUID if missing hyphens
const databaseId = databaseIdRaw.length === 32
    ? `${databaseIdRaw.slice(0, 8)}-${databaseIdRaw.slice(8, 12)}-${databaseIdRaw.slice(12, 16)}-${databaseIdRaw.slice(16, 20)}-${databaseIdRaw.slice(20)}`
    : databaseIdRaw;

const outputPath = path.join(__dirname, '../data/articles.js');

async function getBlockChildren(blockId) {
    const blocks = [];
    let cursor;
    while (true) {
        try {
            const { results, next_cursor } = await notion.blocks.children.list({
                block_id: blockId,
                start_cursor: cursor,
            });
            blocks.push(...results);
            if (!next_cursor) break;
            cursor = next_cursor;
        } catch (e) {
            console.warn(`Failed to fetch children for block ${blockId}:`, e.message);
            break;
        }
    }
    return blocks;
}

// Basic block to HTML converter
function blocksToHtml(blocks) {
    return blocks.map(block => {
        // ... (Keep existing mapping logic, it is generic)
        if (block.type === 'paragraph') {
            const text = block.paragraph.rich_text.map(t => t.plain_text).join('');
            return text ? `<p>${text}</p>` : '';
        }
        if (block.type === 'heading_1') {
            return `<h1>${block.heading_1.rich_text.map(t => t.plain_text).join('')}</h1>`;
        }
        if (block.type === 'heading_2') {
            return `<h2>${block.heading_2.rich_text.map(t => t.plain_text).join('')}</h2>`;
        }
        if (block.type === 'heading_3') {
            return `<h3>${block.heading_3.rich_text.map(t => t.plain_text).join('')}</h3>`;
        }
        if (block.type === 'bulleted_list_item') {
            return `<ul><li>${block.bulleted_list_item.rich_text.map(t => t.plain_text).join('')}</li></ul>`;
        }
        if (block.type === 'numbered_list_item') {
            return `<ol><li>${block.numbered_list_item.rich_text.map(t => t.plain_text).join('')}</li></ol>`;
        }
        if (block.type === 'image') {
            const src = block.image.type === 'external' ? block.image.external.url : block.image.file.url;
            const caption = block.image.caption.map(t => t.plain_text).join('');
            return `<figure><img src="${src}" alt="${caption}"><figcaption>${caption}</figcaption></figure>`;
        }
        return '';
    }).join('');
}

async function fetchArticles() {
    console.log(`Fetching from Notion (ID: ${databaseId})...`);

    try {
        let results = [];
        let sourceName = 'Unknown';

        // Strategy 1: Standard Database Query (using request workaround if method missing)
        try {
            console.log('Attempting standard database query...');
            // Check if query exists, else use request
            if (notion.databases.query) {
                const response = await notion.databases.query({ database_id: databaseId });
                results = response.results;
            } else {
                const response = await notion.request({
                    path: `databases/${databaseId}/query`,
                    method: 'POST',
                    body: {}
                });
                results = response.results;
            }
            console.log(`Standard query successful. Found ${results.length} items.`);
        } catch (e) {
            console.log(`Standard query failed (${e.code}). Checking for Data Source...`);

            // Strategy 2: Check for Data Source
            if (e.code === 'invalid_request_url' || e.code === 'validation_error' || e.status === 400) {
                try {
                    const db = await notion.request({ path: `databases/${databaseId}`, method: 'GET' });
                    if (db.data_sources && db.data_sources.length > 0) {
                        const dsId = db.data_sources[0].id;
                        sourceName = db.data_sources[0].name; // e.g. "Tasks"
                        console.log(`Found Data Source "${sourceName}" (ID: ${dsId}). Querying...`);

                        if (notion.dataSources && notion.dataSources.query) {
                            const dsResponse = await notion.dataSources.query({ data_source_id: dsId });
                            results = dsResponse.results;
                        } else {
                            const dsResponse = await notion.request({
                                path: `data_sources/${dsId}/query`,
                                method: 'POST',
                                body: {}
                            });
                            results = dsResponse.results;
                        }
                        console.log(`Data Source query successful. Found ${results.length} items.`);
                    } else {
                        throw e; // No data source, rethrow original error
                    }
                } catch (innerE) {
                    console.error('Failed to recover via Data Source:', innerE.message);
                    throw e; // Throw original or new error
                }
            } else {
                throw e;
            }
        }

        const articles = [];

        for (const page of results) {
            const props = page.properties;

            // Helper to find property by name (case insensitive) or type
            const getProp = (keys) => {
                for (const key of keys) {
                    const match = Object.keys(props).find(k => k.toLowerCase() === key.toLowerCase());
                    if (match) return props[match];
                }
                return null;
            };

            // 1. Status Check
            // Supports 'Status', 'State', etc.
            const statusProp = getProp(['Status', 'State', 'Publish']);
            let isPublished = true;
            if (statusProp && statusProp.type === 'status') {
                const statusName = statusProp.status?.name?.toLowerCase() || '';
                // Modify this logic based on user preference. For 'Tasks', maybe 'Done' or 'In progress'?
                // For now, let's accept everything EXCEPT 'Not started' or 'Archived' if strictly filtering?
                // Or just accept everything for debugging.
                // Let's filter for valid articles if it looks like a CMS.
                // User said "CMS", so maybe "Published" or "Done".
                if (statusName === 'not started') isPublished = false;
            } else if (statusProp && statusProp.type === 'select') {
                const selectName = statusProp.select?.name?.toLowerCase() || '';
                if (selectName !== 'published' && selectName !== 'done') isPublished = false;
            }

            // Commenting out strict filtering for now to ensure we see data
            // if (!isPublished) continue; 

            const id = page.id;

            // 2. Title Mapping
            // 'Name', 'Title', 'Task name', 'Page', '제목'
            const titleProp = getProp(['Title', 'Name', 'Task name', 'Page', '제목', '기사 제목']);
            let title = 'Untitled';

            if (titleProp) {
                if (titleProp.type === 'title' && titleProp.title.length > 0) {
                    title = titleProp.title.map(t => t.plain_text).join('');
                } else if (titleProp.type === 'rich_text' && titleProp.rich_text.length > 0) {
                    // Sometimes database titles are rich_text if not the primary key?
                    title = titleProp.rich_text.map(t => t.plain_text).join('');
                }
            }

            // 3. Date Mapping
            // 'Date', 'Due date', 'Publish Date'
            const dateProp = getProp(['Date', 'Due date', 'Publish Date']);
            let date = new Date().toISOString().split('T')[0];
            if (dateProp) {
                if (dateProp.type === 'date' && dateProp.date) {
                    date = dateProp.date.start;
                }
            }

            // 4. Category Mapping
            // 'Category', 'Priority', 'Tag', 'Tags'
            const catProp = getProp(['Category', 'Priority', 'Tag', 'Tags']);
            let category = 'uncategorized';
            if (catProp) {
                if (catProp.type === 'select' && catProp.select) {
                    category = catProp.select.name.toLowerCase();
                } else if (catProp.type === 'multi_select' && catProp.multi_select.length > 0) {
                    category = catProp.multi_select[0].name.toLowerCase();
                } else if (catProp.type === 'status') {
                    category = catProp.status.name.toLowerCase();
                }
            }

            // 5. Author Mapping
            // 'Author', 'Assign', 'Assignee', 'Person'
            const authorProp = getProp(['Author', 'Assign', 'Assignee']);
            let author = 'Anonymous';
            if (authorProp) {
                if (authorProp.type === 'people' && authorProp.people.length > 0) {
                    author = authorProp.people.map(p => p.name).join(', ');
                } else if (authorProp.type === 'rich_text' && authorProp.rich_text.length > 0) {
                    author = authorProp.rich_text.map(t => t.plain_text).join('');
                }
            }

            // Fetch content
            process.stdout.write(`Fetching content for "${title}"... `);
            const blocks = await getBlockChildren(id);
            const body = blocksToHtml(blocks);
            console.log('Done.');

            articles.push({
                id,
                category,
                title,
                author,
                date,
                body,
                views: 0
            });
        }

        const fileContent = `/**
 * 빛청모 월간지 WAVE - 기본 기사 데이터 (Notion 연동)
 * Generated at ${new Date().toLocaleString()}
 * Source: ${sourceName}
 */
window.MONTHLYWAVE_DEFAULT_ARTICLES = ${JSON.stringify(articles, null, 2)};
`;

        fs.writeFileSync(outputPath, fileContent);
        console.log(`Successfully fetched ${articles.length} articles and saved to data/articles.js`);

    } catch (error) {
        if (error.code === 'object_not_found') {
            console.error('\n[ERROR] Notion DB not found. Please connect the integration.');
        } else if (error.code === 'unauthorized') {
            console.error('\n[ERROR] Invalid API Key.');
        } else {
            console.error('\n[ERROR] Unexpected error:', error);
        }
    }
}

fetchArticles();
