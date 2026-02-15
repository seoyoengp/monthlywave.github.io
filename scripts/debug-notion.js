const { Client } = require('@notionhq/client');
require('dotenv').config();

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const databaseIdRaw = process.env.NOTION_DATABASE_ID;
// Format UUID if missing hyphens
const id = databaseIdRaw.length === 32
    ? `${databaseIdRaw.slice(0, 8)}-${databaseIdRaw.slice(8, 12)}-${databaseIdRaw.slice(12, 16)}-${databaseIdRaw.slice(16, 20)}-${databaseIdRaw.slice(20)}`
    : databaseIdRaw;

console.log(`Testing DB ID: ${id}`);

async function debug() {
    try {
        console.log('--- Step 1: Retrieve details (Database or Page) ---');
        let db;
        try {
            db = await notion.request({ path: `databases/${id}`, method: 'GET' });
            console.log('Success! It IS a Database.');
        } catch (e) {
            console.log(`Not a Database (${e.code}). Trying as Page...`);
            try {
                const page = await notion.request({ path: `pages/${id}`, method: 'GET' });
                console.log('Success! It IS a Page.');
                console.log('Page Title:', page.properties?.title?.title?.[0]?.plain_text || 'Untitled');
                console.log('This might be a parent page. You need the ID of the inline database inside it, or verify integration connection.');
                return;
            } catch (pageE) {
                console.log(`Not a Page either (${pageE.code}).`);
                console.log('Possible causes:');
                console.log('1. Integration NOT connected to this page.');
                console.log('2. ID is completely wrong.');
                throw e; // Rethrow original DB error
            }
        }

        if (db.data_sources && db.data_sources.length > 0) {
            const dataSourceId = db.data_sources[0].id;
            console.log(`Found Data Source ID: ${dataSourceId}`);

            console.log('\n--- Step 2: Query Data Source ---');
            try {
                // Try using the SDK method first if available
                if (notion.dataSources && notion.dataSources.query) {
                    console.log('Using notion.dataSources.query...');
                    const response = await notion.dataSources.query({
                        data_source_id: dataSourceId,
                    });
                    console.log(`Success! Found ${response.results.length} items.`);
                    if (response.results.length > 0) {
                        const firstProps = response.results[0].properties;
                        console.log('Sample properties keys:', Object.keys(firstProps));
                        console.log('Status Property:', JSON.stringify(firstProps['Status'], null, 2));
                    }
                } else {
                    console.log('notion.dataSources.query missing (should not happen based on prev test)...');
                }
            } catch (dsError) {
                console.error('Data Source Query Failed:', dsError.message);
            }

        } else {
            console.log('No data_sources found in this database object.');
        }

    } catch (e) {
        console.log('Overall Failure:', e.message);
    }
}

debug();
