import { generateHsCode } from "@/lib/ai";

async function main() {
  const samples = [
    {
      skuId: "smoke-1",
      title: "iPhone 16 Pro 256GB",
      description: "Latest Apple smartphone, A18 Pro chip, 5G cellular, titanium body",
      materials: [{ material: "titanium", pct: 100 }],
      supplierCountry: "CN",
      imageUrls: [],
    },
    {
      skuId: "smoke-2",
      title: "Hand-knotted Persian wool rug 8x10",
      description: "Traditional Tabriz pattern, 100% wool pile on cotton warp, 9'x12'",
      materials: [{ material: "wool", pct: 100 }],
      supplierCountry: "IR",
      imageUrls: [],
    },
  ];
  for (const s of samples) {
    const result = await generateHsCode(s);
    console.log(`\n--- ${s.title} ---`);
    console.log(JSON.stringify(result, null, 2));
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
