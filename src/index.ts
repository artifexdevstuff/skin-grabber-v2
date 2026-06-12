import { ShardingManager } from 'discord.js';
import * as dotenv from 'dotenv';
import path from 'path';

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
