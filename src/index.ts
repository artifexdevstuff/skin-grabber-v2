import { ShardingManager } from 'discord.js';
import * as dotenv from 'dotenv';
import path from 'path';
import http from 'http';

import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const manager = new ShardingManager(path.join(__dirname, 'bot.js'), {
    token: process.env.DISCORD_TOKEN!,
    totalShards: 'auto',
});

manager.on('shardCreate', shard => console.log(`Launched shard ${shard.id}`));

manager.spawn().catch(console.error);

// Keep-alive server for Render.com
const port = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Skin Grabber V2 is running!\n');
}).listen(port, () => {
    console.log(`Keep-alive server listening on port ${port}`);
});
