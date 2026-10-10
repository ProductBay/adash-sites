import sharp from "sharp";
import { join } from "node:path";

const directory = join(process.cwd(), "apps/site-runtime/public/images");
const crops = [
  ["citrus-still-life", "citrus-mango", { left: 240, top: 420, width: 580, height: 580 }],
  ["citrus-still-life", "citrus-bottles", { left: 650, top: 85, width: 680, height: 680 }],
  ["citrus-still-life", "citrus-slices", { left: 790, top: 430, width: 580, height: 580 }],
  ["coffee-still-life", "coffee-cup", { left: 390, top: 440, width: 580, height: 580 }],
  ["coffee-still-life", "coffee-bottle", { left: 790, top: 90, width: 600, height: 600 }],
  ["coffee-still-life", "coffee-pastry", { left: 930, top: 430, width: 580, height: 580 }]
];
await Promise.all(crops.map(([source, target, region]) => sharp(join(directory, `${source}.webp`)).extract(region).resize(760, 760).webp({ quality: 82 }).toFile(join(directory, `${target}.webp`))));
