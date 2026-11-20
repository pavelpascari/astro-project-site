import { greet } from './greet.mjs';

document.getElementById('out').textContent = `Loaded a sibling module at ${new Date().toISOString()}`;

const data = await fetch('../data/greeting.json').then((r) => r.json());
document.getElementById('data').textContent = greet(data.name);
