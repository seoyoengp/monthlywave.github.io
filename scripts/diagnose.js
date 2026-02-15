require('dotenv').config();
const { Client } = require('@notionhq/client');

const apiKey = process.env.NOTION_API_KEY ? process.env.NOTION_API_KEY.trim() : '';
const databaseIdRaw = process.env.NOTION_DATABASE_ID ? process.env.NOTION_DATABASE_ID.trim() : '';

// Format UUID
const databaseId = databaseIdRaw.length === 32
    ? `${databaseIdRaw.slice(0, 8)}-${databaseIdRaw.slice(8, 12)}-${databaseIdRaw.slice(12, 16)}-${databaseIdRaw.slice(16, 20)}-${databaseIdRaw.slice(20)}`
    : databaseIdRaw;

console.log('--- Configuration ---');
console.log('API Key (masked):', apiKey.slice(0, 4) + '...');
console.log('Database ID Raw:', databaseIdRaw);
console.log('Database ID Fmt:', databaseId);
console.log('---------------------\n');

const notion = new Client({ auth: apiKey });

async function runDiagnosis() {
    // 1. Test Auth
    console.log('1. Testing Authentication (users.me)...');
    try {
        const user = await notion.users.me({});
        console.log('✅ Auth Success:', user.name || user.id);
    } catch (e) {
        console.error('❌ Auth Failed:', e.code, e.message);
        return; // Stop if auth fails
    }

    // 2. Test Database Retrieval (using SDK method if available, else manual)
    console.log('\n2. Testing Database Retrieval...');
    try {
        const db = await notion.databases.retrieve({ database_id: databaseId });
        console.log('✅ Retrieve Success:', db.title[0]?.plain_text || 'Untitled');
    } catch (e) {
        console.error('❌ Retrieve Failed:', e.code, e.message);
    }

    // 3. Test Database Query (Manual Request)
    console.log('\n3. Testing Database Query (Manual via notion.request)...');
    try {
        const response = await notion.request({
            path: `databases/${databaseId}/query`,
            method: 'POST',
            body: { page_size: 1 } // Minimal body
        });
        console.log('✅ Query Success. Results:', response.results.length);
    } catch (e) {
        console.error('❌ Query Failed:', e.code, e.message);
    }
}

runDiagnosis();
