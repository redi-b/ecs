import {
  buildRichDescription,
  singleAxisProduct,
} from "./catalog-builders.js";
import type { DemoShopDefinition } from "./types.js";

/** Fashion & Clean Cosmetics shop — skincare, makeup, fragrance, body care. */
export const fashionShop: DemoShopDefinition = {
  ids: {
    tenant: "d2000000-0000-4000-8000-000000000001",
    domain: "d2000000-0000-4000-8000-000000000002",
    user: "d2000000-0000-4000-8000-000000000003",
    account: "d2000000-0000-4000-8000-000000000003:credential",
    membership: "d2000000-0000-4000-8000-000000000004",
    onboarding: "d2000000-0000-4000-8000-000000000005",
    storefrontRevision: "d2000000-0000-4000-8000-000000000006",
    storefrontConfig: "d2000000-0000-4000-8000-000000000007",
  },
  templateKey: "luvia@1",
  tenant: {
    handle: "bolestyle",
    name: "Bole Style",
  },
  user: {
    email: "mahi@bolestyle.ecs.et",
    name: "Mahlet Kebede",
    phone: "+251911100002",
  },
  paymentOnboarding: {
    status: "not_configured",
    notes: "Demo shop — connect Chapa in Settings when testing online pay.",
  },
  shopDetails: {
    version: 1,
    categories: ["Beauty", "Skincare"],
    description:
      "Bole Style curates premium skincare, makeup, and fragrance for the modern Ethiopian woman. Every product is carefully selected for efficacy, clean formulation, and suitability for our climate.",
    primaryPhone: "+251911100002",
    additionalPhones: ["+251933300002"],
    publicEmail: "hello@bolestyle.com",
    address: {
      city: "Addis Ababa",
      streetAddress: "Bole Road, Woreda 3, Jomo Building, 2nd Floor",
      directions: "Above Lime Tree Café, near Edna Mall",
    },
    socialProfiles: [
      { platform: "instagram", url: "https://www.instagram.com/bolestyle.et" },
      { platform: "tiktok", url: "https://www.tiktok.com/@bolestyle.et" },
      { platform: "facebook", url: "https://www.facebook.com/bolestyle.et" },
      { platform: "telegram", url: "https://t.me/bolestyle" },
      { platform: "whatsapp", url: "https://wa.me/251911100002" },
    ],
  },
  categories: [
    { name: "Skincare", handle: "demo-fashion-skincare", mediaUrl: "category-skincare.webp" },
    {
      name: "Serums & Elixirs",
      handle: "demo-fashion-skincare-serums",
      parentHandle: "demo-fashion-skincare",
      mediaUrl: "category-skincare.webp",
    },
    {
      name: "Cleansers & Toners",
      handle: "demo-fashion-skincare-cleansers",
      parentHandle: "demo-fashion-skincare",
      mediaUrl: "category-skincare.webp",
    },
    {
      name: "Moisturizers & Creams",
      handle: "demo-fashion-skincare-creams",
      parentHandle: "demo-fashion-skincare",
      mediaUrl: "category-skincare.webp",
    },
    { name: "Makeup & Complexion", handle: "demo-fashion-makeup", mediaUrl: "category-makeup.webp" },
    {
      name: "Lipsticks & Tints",
      handle: "demo-fashion-makeup-lips",
      parentHandle: "demo-fashion-makeup",
      mediaUrl: "category-makeup.webp",
    },
    { name: "Fragrance & Scents", handle: "demo-fashion-fragrance", mediaUrl: "category-fragrance.webp" },
    { name: "Body & Bath", handle: "demo-fashion-body", mediaUrl: "category-body.webp" },
  ],
  collections: [
    { title: "Best Sellers", handle: "demo-fashion-new-season", mediaUrl: "collection-best-sellers.webp" },
    { title: "Daily Rituals", handle: "demo-fashion-essentials", mediaUrl: "collection-daily-rituals.webp" },
    { title: "Gift Sets & Curations", handle: "demo-fashion-gift-picks", mediaUrl: "collection-gift-sets.webp" },
    { title: "Special Offers", handle: "demo-fashion-offers", mediaUrl: "collection-special-offers.webp" },
  ],
  customers: [
    {
      firstName: "Mahi",
      lastName: "Kebede",
      email: "mahi.kebede.style@example.com",
      phone: "+251911300201",
      area: "Bole",
      address: "Bole Atlas",
    },
    {
      firstName: "Yonas",
      lastName: "Assefa",
      email: "yonas.assefa.style@example.com",
      phone: "+251911300202",
      area: "Sarbet",
      address: "Sarbet Gabriel",
    },
    {
      firstName: "Ruth",
      lastName: "Getachew",
      email: "ruth.getachew.style@example.com",
      phone: "+251911300203",
      area: "Old Airport",
      address: "Old Airport Residence",
    },
    {
      firstName: "Samuel",
      lastName: "Berhanu",
      email: "samuel.berhanu.style@example.com",
      phone: "+251911300204",
      area: "Megenagna",
      address: "Megenagna Square",
    },
    {
      firstName: "Selam",
      lastName: "Abebe",
      email: "selam.abebe.style@example.com",
      phone: "+251911300205",
      area: "Kazanchis",
      address: "Kazanchis Twin Towers",
    },
    {
      firstName: "Nahom",
      lastName: "Fikru",
      email: "nahom.fikru.style@example.com",
      phone: "+251911300206",
      area: "CMC",
      address: "CMC Summit",
    },
    {
      firstName: "Helen",
      lastName: "Worku",
      email: "helen.worku.style@example.com",
      phone: "+251911300207",
      area: "Piassa",
      address: "Piassa Churchill",
    },
    {
      firstName: "Meron",
      lastName: "Desta",
      email: "meron.desta.style@example.com",
      phone: "+251911300208",
      area: "Hayahulet",
      address: "Hayahulet Mazoria",
    },
    {
      firstName: "Eyob",
      lastName: "Solomon",
      email: "eyob.solomon.style@example.com",
      phone: "+251911300209",
      area: "Lebu",
      address: "Lebu Mebrat Hail",
    },
  ],
  products: [
    // 1. Hyaluronic Hydration Serum
    {
      ...singleAxisProduct(
        "Aura Hyaluronic Hydration Serum",
        "demo-fashion-hyaluronic-serum",
        "skincare",
        1850,
        "Volume",
        ["30ml", "50ml"],
        [24, 16],
        buildRichDescription({
          overview:
            "Formulated with multi-depth botanical hyaluronic acid and pure alpine glacier water. Delivers continuous 72-hour deep cellular hydration, replenishing dry skin barrier layers and imparting an instantaneous dewy bounce.",
          features: [
            "Triple-weight Hyaluronic Acid complex delivers hydration across all dermal strata",
            "Weightless crystal-clear fluid absorbs in seconds with zero tacky residue",
            "Botanical antioxidant complex shields against urban micro-pollutants",
            "100% Fragrance-free, hypoallergenic, and formulated for sensitive skin",
          ],
          specs: {
            Volume: "30ml (1.0 fl. oz.) / 50ml (1.7 fl. oz.)",
            SkinTypes: "All skin types (Ideal for dehydrated, dull, and compromised barriers)",
            Texture: "Ultra-lightweight silky water-gel serum",
            KeyActives: "2.4% Multi-Molecular Hyaluronic Acid, Organic Aloe Barbadensis, Panthenol",
          },
          inTheBox: [
            "Frosted Glass Dropper Bottle",
            "Precision Glass Pipette Dispenser",
            "Botanical Skincare Routine Guide",
          ],
          note: "Apply 3-4 drops directly onto freshly cleansed, damp skin before face creams.",
        }),
      ),
      categoryHandle: "demo-fashion-skincare-serums",
      collectionHandle: "demo-fashion-new-season",
    },

    // 2. Botanical Bakuchiol Radiance Oil
    {
      ...singleAxisProduct(
        "Botanical Bakuchiol Radiance Oil",
        "demo-fashion-bakuchiol-oil",
        "skincare",
        2250,
        "Volume",
        ["30ml", "50ml"],
        [20, 12],
        buildRichDescription({
          overview:
            "A potent plant-powered alternative to retinol. Infused with 1% pure organic Bakuchiol suspended in cold-pressed rosehip and Ethiopian black seed oil to visibly smooth fine lines, refine texture, and enhance skin radiance without irritation or photosensitivity.",
          features: [
            "1% Clinical Bakuchiol provides all retinol benefits without peeling or redness",
            "Cold-pressed virgin Rosehip Seed and Ethiopian Black Cumin oil base",
            "Rich in vitamins A, C, and essential omegas 3, 6, and 9",
            "Safe for day and night use; non-comedogenic and gentle on reactive skin",
          ],
          specs: {
            Volume: "30ml (1.0 fl. oz.) / 50ml (1.7 fl. oz.)",
            SkinTypes: "All skin types, especially sensitive and aging skin",
            Texture: "Fast-absorbing dry botanical elixir with a golden sheen",
          },
          inTheBox: [
            "Amber UV-Protective Glass Dropper Bottle",
            "Precision Pipette Applicator",
          ],
          note: "Warm 3 drops between clean palms and press gently into face, neck, and décolletage.",
        }),
        {
          priceMultipliers: [1, 1.42],
        },
      ),
      categoryHandle: "demo-fashion-skincare-serums",
      collectionHandle: "demo-fashion-essentials",
    },

    // 3. Vitamin C Brightening Eye Elixir
    {
      ...singleAxisProduct(
        "Vitamin C Brightening Eye Elixir",
        "demo-fashion-eye-elixir",
        "skincare",
        1750,
        "Volume",
        ["15ml", "30ml"],
        [22, 14],
        buildRichDescription({
          overview:
            "An invigorating targeted eye treatment featuring stabilized 5% Vitamin C, green tea caffeine, and revitalizing peptides. Delivered via an ergonomic cooling ceramic applicator tip that instantly depuffs morning under-eye swelling and brightens stubborn dark circles.",
          features: [
            "Sculpted cooling ceramic applicator tip visibly drains fluid and depuffs tired eyes",
            "5% Stabilized Vitamin C ester illuminates shadows and fades under-eye discoloration",
            "Green tea caffeine and botanical peptide matrix tighten lax delicate skin",
            "Featherweight cream-gel texture wears seamlessly beneath makeup with zero creasing",
          ],
          specs: {
            Volume: "15ml (0.5 fl. oz.) / 30ml (1.0 fl. oz.)",
            Applicator: "Ergonomic cooling ceramic & brushed platinum tip",
            KeyActives: "5% Vitamin C Ester, Green Tea Caffeine, Palmitoyl Tripeptide-38",
          },
          inTheBox: ["Precision Ceramic Tip Eye Elixir Tube"],
          note: "Gently squeeze tube and glide cooling ceramic tip across orbital bone.",
        }),
        {
          priceMultipliers: [1, 1.54],
        },
      ),
      categoryHandle: "demo-fashion-skincare-serums",
      collectionHandle: "demo-fashion-essentials",
    },

    // 4. Oat & Camellia Purifying Gel Cleanser
    {
      ...singleAxisProduct(
        "Oat & Camellia Purifying Gel Cleanser",
        "demo-fashion-camellia-cleanser",
        "skincare",
        1450,
        "Volume",
        ["150ml", "250ml"],
        [28, 18],
        buildRichDescription({
          overview:
            "A pH-balanced 5.5 daily gel cleanser that melts away waterproof sunscreen, makeup, and daily impurities while preserving the vital skin barrier. Infused with soothing colloidal oat extract, wild camellia seed oil, and gentle sugar-derived surfactants.",
          features: [
            "Gentle pH 5.5 formulation respects the acid mantle and prevents post-wash tightness",
            "Colloidal Oat and Wild Camellia oil calm irritation and redness on contact",
            "Sulfate-free, soap-free, biodegradable plant-derived cleansing base",
            "Effortlessly removes long-wear foundation and eye makeup without stinging",
          ],
          specs: {
            Volume: "150ml (5.1 fl. oz.) / 250ml (8.5 fl. oz.)",
            Texture: "Silky foaming amber gel with a subtle natural botanical aroma",
            Pump: "Lockable matte black dispensing pump mechanism",
          },
          inTheBox: ["Amber Frosted Pump Bottle with protective travel clip"],
          note: "Massage 1-2 pumps onto damp skin for 60 seconds; rinse thoroughly with lukewarm water.",
        }),
        {
          priceMultipliers: [1, 1.48],
        },
      ),
      categoryHandle: "demo-fashion-skincare-cleansers",
      collectionHandle: "demo-fashion-essentials",
    },

    // 5. Balancing Rosemary & Rose Hydrosol Mist
    {
      ...singleAxisProduct(
        "Balancing Rosemary & Rose Hydrosol Mist",
        "demo-fashion-rosemary-mist",
        "skincare",
        1150,
        "Volume",
        ["100ml", "200ml"],
        [30, 16],
        buildRichDescription({
          overview:
            "Steam-distilled from organic high-altitude rosemary sprigs and damask rose petals. A refreshing micro-fine botanical toner mist that instantly rebalances skin pH, refines pores, and delivers a surge of hydration throughout the day.",
          features: [
            "100% Pure steam-distilled organic rose and wild rosemary floral hydrosols",
            "Micro-atomizer spray pump delivers an ultra-fine, even dewy mist cloud",
            "Niacinamide and witch hazel extract gently tighten enlarged pores",
            "Versatile formula serves as toner, midday hydrator, and makeup setting spray",
          ],
          specs: {
            Volume: "100ml (3.4 fl. oz.) / 200ml (6.8 fl. oz.)",
            Nozzle: "Ultra-fine continuous micro-atomizer spray",
            Ingredients: "Rosa Damascena Flower Water, Rosmarinus Officinalis Water, Niacinamide",
          },
          inTheBox: ["Frosted Glass Atomizer Bottle with protective cap"],
          note: "Mist generously over face after cleansing or whenever skin requires a midday radiance boost.",
        }),
        {
          priceMultipliers: [1, 1.6],
        },
      ),
      categoryHandle: "demo-fashion-skincare-cleansers",
      collectionHandle: "demo-fashion-essentials",
    },

    // 6. Ceramide Barrier Moisture Cream (ON SALE TEST CASE)
    {
      ...singleAxisProduct(
        "Ceramide Barrier Moisture Cream",
        "demo-fashion-ceramide-cream",
        "skincare",
        2100,
        "Size",
        ["50ml", "100ml"],
        [25, 12],
        buildRichDescription({
          overview:
            "A rich, velvety restorative cream engineered with a 3:1:1 physiological lipid ratio of bio-identical ceramides, plant cholesterol, and essential fatty acids. Deeply repairs compromised skin barriers, seals in moisture, and protects against harsh dry winds.",
          features: [
            "Bio-identical Ceramide Complex (EOP, NP, AP) restores vulnerable lipid barriers",
            "Whipped cloud-like texture absorbs smoothly without greasy residue",
            "Plant-derived Squalane and Centella Asiatica soothe visible irritation",
            "Provides proven 48-hour continuous moisture retention",
          ],
          specs: {
            Volume: "50ml (1.7 fl. oz.) / 100ml (3.4 fl. oz.)",
            Container: "Heavy-walled frosted cylindrical glass jar with matte stone-beige lid",
            Texture: "Rich, decadent whipped ivory moisture cream",
          },
          inTheBox: [
            "Heavy-Walled Frosted Glass Jar",
            "Bespoke Bamboo Cosmetic Spatula",
          ],
          note: "On Sale: Save 550 ETB on 50ml jar. The definitive barrier restoration treatment.",
        }),
        {
          originalPrice: 2650,
          priceMultipliers: [1, 1.62],
        },
      ),
      categoryHandle: "demo-fashion-skincare-creams",
      collectionHandle: "demo-fashion-offers",
    },

    // 7. Overnight Restorative Peptide Mask
    {
      ...singleAxisProduct(
        "Overnight Restorative Peptide Mask",
        "demo-fashion-peptide-mask",
        "skincare",
        2350,
        "Size",
        ["60ml", "100ml"],
        [18, 10],
        buildRichDescription({
          overview:
            "An intensive leave-on sleeping mask formulated with a 5-peptide matrix and tremella snow mushroom extract. Works in harmony with the body's nocturnal repair cycle to firm skin, diminish signs of fatigue, and restore plump, rested vitality by morning.",
          features: [
            "Multi-Peptide blend stimulates overnight collagen and cellular rejuvenation",
            "Tremella Snow Mushroom holds 500x its weight in water for plumping hydration",
            "Cooling jade gel-cream texture wraps skin in an invisible moisture reservoir",
            "Pillow-safe, fast-absorbing formula that will not rub off on bed linens",
          ],
          specs: {
            Volume: "60ml (2.0 fl. oz.) / 100ml (3.4 fl. oz.)",
            Container: "Deep sage-green tinted glass cosmetic jar with brushed silver lid",
            Texture: "Cooling jade gel-cream sleeping mask",
          },
          inTheBox: [
            "Sage Green Glass Jar",
            "Application & Overnight Ritual Card",
          ],
          note: "Smooth a generous layer over face as the final step in your evening routine 2-3 nights per week.",
        }),
        {
          priceMultipliers: [1, 1.47],
        },
      ),
      categoryHandle: "demo-fashion-skincare-creams",
      collectionHandle: "demo-fashion-new-season",
    },

    // 8. Multi-Active Restoring Barrier Balm
    {
      ...singleAxisProduct(
        "Multi-Active Restoring Barrier Balm",
        "demo-fashion-barrier-balm",
        "skincare",
        780,
        "Size",
        ["20ml", "40ml"],
        [35, 20],
        buildRichDescription({
          overview:
            "A concentrated SOS rescue salve in an aluminum travel tube. Combines 5% panthenol (pro-vitamin B5), madecassoside, and organic shea butter to immediately heal dry cracked lips, irritated dry patches, and rough cuticles.",
          features: [
            "5% Panthenol (Vitamin B5) accelerates skin tissue recovery and soothes irritation",
            "Pure Madecassoside from Centella Asiatica calms redness on contact",
            "Multi-use: perfect for chapped lips, dry cheekbones, hands, and cuticles",
            "Pocket-friendly minimalist aluminum squeeze tube with octagonal cap",
          ],
          specs: {
            Volume: "20ml (0.7 fl. oz.) / 40ml (1.4 fl. oz.)",
            Tube: "Recyclable matte off-white aluminum tube with faceted cap",
            Texture: "Rich protective melting ointment balm",
          },
          inTheBox: ["Aluminum Barrier Balm Squeeze Tube"],
          note: "Apply as needed to dry, chapped, or sensitized areas throughout the day.",
        }),
        {
          priceMultipliers: [1, 1.64],
        },
      ),
      categoryHandle: "demo-fashion-skincare-creams",
      collectionHandle: "demo-fashion-essentials",
    },

    // 9. Luminous Silk Serum Foundation (SALE + MULTI-SHADE TEST CASE)
    {
      ...singleAxisProduct(
        "Luminous Silk Serum Foundation",
        "demo-fashion-serum-foundation",
        "makeup",
        2400,
        "Shade",
        ["Fair Neutral", "Medium Warm", "Deep Bronze"],
        [15, 12, 10],
        buildRichDescription({
          overview:
            "A weightless serum foundation that unifies skincare and makeup. Provides customizable light-to-medium coverage with a natural satin-skin finish that blurs pores, evens skin tone, and glows with healthy, breathable radiance.",
          features: [
            "Infused with hyaluronic acid and niacinamide for all-day skincare benefits",
            "Light-reflecting mineral pigments blur imperfections without settling into lines",
            "Breathable second-skin feel that resists humidity and transfer for 16 hours",
            "Custom buildable coverage from sheer tint to flawless medium veil",
          ],
          specs: {
            Volume: "30ml (1.0 fl. oz.)",
            Finish: "Luminous satin skin finish (Natural skin-like glow)",
            SPF: "Broad Spectrum SPF 20 Mineral Protection",
          },
          inTheBox: [
            "Frosted Glass Cylinder Bottle with champagne-gold pump",
            "Shade & Application Guide",
          ],
          note: "On Sale: Save 500 ETB. Shake well before pumping 1-2 drops onto brush or fingertips.",
        }),
        {
          originalPrice: 2900,
          swatches: {
            Shade: {
              "Fair Neutral": { kind: "color", value: "#E8DACB" },
              "Medium Warm": { kind: "color", value: "#C6A789" },
              "Deep Bronze": { kind: "color", value: "#8C5B3E" },
            },
          },
        },
      ),
      categoryHandle: "demo-fashion-makeup",
      collectionHandle: "demo-fashion-offers",
    },

    // 10. Velvet Matte Satin Lipstick (PARTIALLY SOLD OUT TEST CASE: Crimson Velvet is stock 0!)
    {
      ...singleAxisProduct(
        "Velvet Matte Satin Lipstick",
        "demo-fashion-satin-lipstick",
        "makeup",
        1650,
        "Shade",
        ["Bare Nude", "Crimson Velvet", "Dusty Dahlia"],
        // Crimson Velvet (index 1) = 0 stock!
        [15, 0, 12],
        buildRichDescription({
          overview:
            "A decadent satin-matte lipstick delivering intense, one-swipe opaque pigment with the nourishing comfort of a lip balm. Housed in a satisfying magnetic square casing with polished brass accents.",
          features: [
            "Ultra-fine micronized pigments deliver saturated opaque color in one stroke",
            "Enriched with murumuru butter and hyaluronic microspheres for cushiony wear",
            "Non-drying velvet matte texture remains comfortable without feathering for 8 hours",
            "Sculpted teardrop bullet allows ultra-precise cupid's bow and contour application",
          ],
          specs: {
            Weight: "3.8g (0.13 oz.)",
            Casing: "Heavy magnetic square matte black casing with brass core",
            Finish: "Velvety satin-matte",
          },
          inTheBox: ["Magnetic Velvet Matte Lipstick in luxury gift box"],
          note: "Crimson Velvet is currently out of stock due to high demand. Bare Nude and Dusty Dahlia are available.",
        }),
        {
          swatches: {
            Shade: {
              "Bare Nude": { kind: "color", value: "#C88A78" },
              "Crimson Velvet": { kind: "color", value: "#8B1E2B" },
              "Dusty Dahlia": { kind: "color", value: "#A05A65" },
            },
          },
        },
      ),
      categoryHandle: "demo-fashion-makeup-lips",
      collectionHandle: "demo-fashion-new-season",
    },

    // 11. Dewy Liquid Sculpt & Glow Highlighter
    {
      ...singleAxisProduct(
        "Dewy Liquid Sculpt & Glow Highlighter",
        "demo-fashion-liquid-highlighter",
        "makeup",
        1550,
        "Shade",
        ["Celestial Champagne", "Rose Quartz", "Golden Hour"],
        [20, 14, 8],
        buildRichDescription({
          overview:
            "A sheer liquid highlighter featuring ultra-fine micro-pearls that reflect light with an ethereal, glass-skin finish. Blends seamlessly over makeup or directly onto bare skin for an effortless candlelit glow.",
          features: [
            "Micro-milled champagne and rose pearls melt into skin without visible chunky glitter",
            "Plush doe-foot cushion wand enables precise spot-highlighting on cheekbones and nose",
            "Infused with jojoba seed oil for a dewy, non-drying lit-from-within glow",
            "Multi-use: tap onto high points or mix 1 drop into foundation for all-over radiance",
          ],
          specs: {
            Volume: "15ml (0.5 fl. oz.)",
            Shades: "Celestial Champagne, Rose Quartz, Golden Hour",
            Wand: "Plush doe-foot cushion wand applicator",
          },
          inTheBox: ["Frosted Glass Bottle with rose-gold metallic cap"],
          note: "Dot 2 small drops along cheekbones and brow arch; blend gently with fingertips.",
        }),
        {
          swatches: {
            Shade: {
              "Celestial Champagne": { kind: "color", value: "#F4E7D3" },
              "Rose Quartz": { kind: "color", value: "#E8B4B8" },
              "Golden Hour": { kind: "color", value: "#D4A373" },
            },
          },
        },
      ),
      categoryHandle: "demo-fashion-makeup",
      collectionHandle: "demo-fashion-new-season",
    },

    // 12. Solar Neroli & Cedarwood Eau de Parfum (SALE + MULTI-SIZE)
    {
      ...singleAxisProduct(
        "Solar Neroli & Cedarwood Eau de Parfum",
        "demo-fashion-neroli-fragrance",
        "fragrance",
        3800,
        "Size",
        ["50ml", "100ml"],
        [14, 8],
        buildRichDescription({
          overview:
            "An artisanal unisex fragrance capturing sun-drenched orange groves and ancient cedar forests. Opens with bright Italian neroli and bitter citrus, transitioning into a warm heart of orange blossom, grounded by earthy cedarwood, amber resin, and Haitian vetiver.",
          features: [
            "Top Notes: Bitter Orange, Italian Neroli, Sunlit Bergamot",
            "Heart Notes: Moroccan Orange Blossom, Jasmine Sambac, Pink Peppercorn",
            "Base Notes: Atlas Cedarwood, Warm Amber Resin, Clean White Musk",
            "Concentration: Eau de Parfum with exceptional 12-hour projection and sillage",
          ],
          specs: {
            Volume: "50ml (1.7 fl. oz.) / 100ml (3.4 fl. oz.)",
            Bottle: "Architectural rectangular heavyweight crystal glass with magnetic cap",
            Formulation: "Organic grain alcohol base, phthalate-free, vegan",
          },
          inTheBox: [
            "Heavyweight Crystal Glass Fragrance Flacon",
            "Magnetic Black Travel Cap",
            "Linen-Textured Presentation Box",
          ],
          note: "On Sale: Save 700 ETB on the 50ml bottle. Crafted in Grasse and bottled in small batches.",
        }),
        {
          originalPrice: 4500,
          priceMultipliers: [1, 1.42],
        },
      ),
      categoryHandle: "demo-fashion-fragrance",
      collectionHandle: "demo-fashion-offers",
    },

    // 13. Wild Jasmine Nourishing Body Oil
    {
      ...singleAxisProduct(
        "Wild Jasmine Nourishing Body Oil",
        "demo-fashion-jasmine-body-oil",
        "body",
        1950,
        "Scent",
        ["Wild Jasmine", "Amber & Neroli"],
        [24, 16],
        buildRichDescription({
          overview:
            "A fast-absorbing, non-greasy dry body oil made with golden jojoba, sweet almond, and botanical essences. Delivers intense satin hydration, leaves skin feeling silky-smooth, and envelopes the body in an intoxicating aroma.",
          features: [
            "Non-greasy dry oil blend absorbs instantly so you can dress immediately",
            "Available in intoxicating Night-blooming Jasmine or warm Amber & Neroli",
            "Deeply nourishes dry elbows, knees, and restores all-over body radiance",
            "Fluted glass bottle with brushed gold dispensing pump",
          ],
          specs: {
            Volume: "100ml (3.4 fl. oz.)",
            Bottle: "Fluted ribbed glass with brushed gold pump dispenser",
            KeyIngredients: "Golden Jojoba Oil, Sweet Almond Oil, Botanical Absolutes",
          },
          inTheBox: ["Fluted Glass Body Oil Pump Bottle"],
          note: "Smooth over clean, slightly damp skin after showering for best absorption.",
        }),
        {
          priceMultipliers: [1, 1.1],
        },
      ),
      categoryHandle: "demo-fashion-body",
      collectionHandle: "demo-fashion-essentials",
    },

    // 14. Whipped Shea & Sea Kelp Body Butter
    {
      ...singleAxisProduct(
        "Whipped Shea & Sea Kelp Body Butter",
        "demo-fashion-shea-body-butter",
        "body",
        1050,
        "Size",
        ["100ml", "200ml"],
        [26, 18],
        buildRichDescription({
          overview:
            "Hand-whipped pure unrefined African shea butter blended with mineral-rich Atlantic sea kelp and organic cocoa butter. Melts instantly on contact with skin to provide 48-hour deep nourishment for dry, weather-exposed skin.",
          features: [
            "100% Unrefined Fair-Trade African Shea Butter whipped to a cloud-like texture",
            "Sea Kelp extract provides essential minerals, amino acids, and trace elements",
            "Protects skin from dry mountain wind and extreme atmospheric changes",
            "Subtle natural scent of raw cocoa and warm organic vanilla bean",
          ],
          specs: {
            Volume: "100ml (3.4 fl. oz.) / 200ml (6.7 fl. oz.)",
            Container: "Wide matte sand-colored terracotta jar with beechwood lid",
            Texture: "Decadent whipped body butter with peak retention",
          },
          inTheBox: ["Terracotta Ceramic Jar with Beechwood Lid"],
          note: "Warm a small dollop between hands and massage over dry areas.",
        }),
        {
          priceMultipliers: [1, 1.62],
        },
      ),
      categoryHandle: "demo-fashion-body",
      collectionHandle: "demo-fashion-essentials",
    },

    // 15. The Radiance Essentials 4-Piece Curation
    {
      ...singleAxisProduct(
        "The Radiance Essentials 4-Piece Curation",
        "demo-fashion-curation-box",
        "skincare",
        4850,
        "Edition",
        ["Signature Gift Box", "Deluxe Keepsake Edition"],
        [15, 8],
        buildRichDescription({
          overview:
            "The ultimate luxury beauty gift curation. Beautifully presented in a handcrafted charcoal linen presentation box tied with grosgrain ribbon. Contains travel-size editions of our iconic Hyaluronic Serum, Ceramide Moisture Cream, Rosemary Mist, and Velvet Satin Lipstick.",
          features: [
            "Includes 4 curated best-sellers: Serum (30ml), Cream (30ml), Mist (50ml), and Lipstick",
            "Handcrafted rigid linen keepsake box with custom-fitted protective velvet tray",
            "Over 6,200 ETB combined value in a single commemorative gift collection",
            "The quintessential gift for holidays, celebrations, or self-care indulgence",
          ],
          specs: {
            SetIncludes:
              "Hyaluronic Serum 30ml, Ceramide Cream 30ml, Rosemary Mist 50ml, Velvet Lipstick in Bare Nude",
            Packaging: "Charcoal textured linen presentation box with grosgrain ribbon tie",
          },
          inTheBox: [
            "The Radiance Essentials Keepsake Linen Gift Box",
            "4 Miniature Luxury Products in custom velvet tray",
            "Handwritten-style Gifting Card",
          ],
          note: "Limited seasonal edition. Pre-packaged and ready for gifting with zero wrapping required.",
        }),
        {
          priceMultipliers: [1, 1.28],
        },
      ),
      categoryHandle: "demo-fashion-skincare",
      collectionHandle: "demo-fashion-gift-picks",
    },
  ],
};
