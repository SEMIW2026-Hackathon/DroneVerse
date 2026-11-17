import fs from 'node:fs';

const file = 'apps/web/public/models/sparrow.glb';
const input = fs.readFileSync(file);
const jsonLength = input.readUInt32LE(12);
const json = JSON.parse(input.subarray(20, 20 + jsonLength).toString('utf8').trim());
const binStart = 20 + jsonLength + 8;
const bin = input.subarray(binStart);

const usedViews = new Set(
  json.accessors
    .map((accessor) => accessor.bufferView)
    .filter((index) => index !== undefined),
);
const keptViewIndices = json.bufferViews.map((_, index) => index).filter((index) => usedViews.has(index));
const viewMap = new Map();
const compactBinParts = [];
let compactLength = 0;
const align = (value) => (value + 3) & ~3;

json.bufferViews = keptViewIndices.map((originalIndex, newIndex) => {
  const view = json.bufferViews[originalIndex];
  viewMap.set(originalIndex, newIndex);
  const offset = view.byteOffset ?? 0;
  const bytes = bin.subarray(offset, offset + view.byteLength);
  const alignedOffset = align(compactLength);
  compactBinParts.push(Buffer.alloc(alignedOffset - compactLength), bytes);
  compactLength = alignedOffset + bytes.length;
  return { ...view, byteOffset: alignedOffset };
});

for (const accessor of json.accessors) {
  if (accessor.bufferView !== undefined) accessor.bufferView = viewMap.get(accessor.bufferView);
}
for (const material of json.materials ?? []) {
  delete material.normalTexture;
  if (material.pbrMetallicRoughness) {
    delete material.pbrMetallicRoughness.baseColorTexture;
    delete material.pbrMetallicRoughness.metallicRoughnessTexture;
  }
}
delete json.images;
delete json.textures;
delete json.samplers;
json.buffers[0].byteLength = compactLength;

const compactBin = Buffer.concat([...compactBinParts, Buffer.alloc(align(compactLength) - compactLength)]);
const jsonBytes = Buffer.from(JSON.stringify(json));
const paddedJson = Buffer.concat([jsonBytes, Buffer.alloc(align(jsonBytes.length) - jsonBytes.length, 0x20)]);
const paddedBin = Buffer.concat([compactBin, Buffer.alloc(align(compactBin.length) - compactBin.length)]);
const output = Buffer.alloc(12 + 8 + paddedJson.length + 8 + paddedBin.length);
output.writeUInt32LE(0x46546c67, 0);
output.writeUInt32LE(2, 4);
output.writeUInt32LE(output.length, 8);
let offset = 12;
output.writeUInt32LE(paddedJson.length, offset);
output.writeUInt32LE(0x4e4f534a, offset + 4);
paddedJson.copy(output, offset + 8);
offset += 8 + paddedJson.length;
output.writeUInt32LE(paddedBin.length, offset);
output.writeUInt32LE(0x004e4942, offset + 4);
paddedBin.copy(output, offset + 8);

const temporary = `${file}.tmp`;
fs.writeFileSync(temporary, output);
fs.renameSync(temporary, file);
console.log(`Optimized ${file}: ${input.length} -> ${output.length} bytes`);
