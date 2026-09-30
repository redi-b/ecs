import { buildRichDescription, matrixProduct, singleAxisProduct } from "./catalog-builders.js";
import type { DemoShopDefinition } from "./types.js";

/** Afro shop — contemporary Ethiopian apparel and studio goods. */
export const afroShop: DemoShopDefinition = {
  ids: {
    tenant: "d3000000-0000-4000-8000-000000000001",
    domain: "d3000000-0000-4000-8000-000000000002",
    user: "d3000000-0000-4000-8000-000000000003",
    account: "d3000000-0000-4000-8000-000000000003:credential",
    membership: "d3000000-0000-4000-8000-000000000004",
    onboarding: "d3000000-0000-4000-8000-000000000005",
    storefrontRevision: "d3000000-0000-4000-8000-000000000006",
    storefrontConfig: "d3000000-0000-4000-8000-000000000007",
  },
  templateKey: "afro@1",
  tenant: {
    handle: "afrostudio",
    name: "AFRO Studio",
  },
  user: {
    email: "selam@afrostudio.ecs.et",
    name: "Selam Tesfaye",
    phone: "+251911100003",
  },
  paymentOnboarding: {
    status: "not_configured",
    notes: "Demo shop — connect Chapa in Settings when testing online pay.",
  },
  shopDetails: {
    version: 1,
    categories: ["Fashion", "Apparel"],
    description:
      "AFRO Studio is a contemporary Ethiopian apparel brand rooted in bold style and cultural identity. Each piece is crafted for everyday rhythm — from minimal basics to standout outerwear.",
    primaryPhone: "+251911100003",
    additionalPhones: ["+251944400003"],
    publicEmail: "studio@afrostudio.et",
    address: {
      city: "Addis Ababa",
      streetAddress: "Kazanchis, Africa Avenue, AFRO Studio Building, Ground Floor",
      directions: "Across from the African Union Conference Centre",
    },
    socialProfiles: [
      { platform: "instagram", url: "https://www.instagram.com/afrostudio.et" },
      { platform: "tiktok", url: "https://www.tiktok.com/@afrostudio.et" },
      { platform: "facebook", url: "https://www.facebook.com/afrostudio.et" },
      { platform: "telegram", url: "https://t.me/afrostudio" },
    ],
  },
  categories: [
    { name: "Jackets & Outerwear", handle: "demo-afro-jackets", mediaUrl: "bg-jackets.png" },
    { name: "T-Shirts & Tops", handle: "demo-afro-tshirts", mediaUrl: "bg-shirts.png" },
    { name: "Trousers & Denim", handle: "demo-afro-trousers", mediaUrl: "bg-trousers.png" },
    { name: "Shirts", handle: "demo-afro-shirts", mediaUrl: "bg-shirts.png" },
    { name: "Sets & Tracksuits", handle: "demo-afro-sets", mediaUrl: "product-9.png" },
    { name: "Accessories", handle: "demo-afro-accessories", mediaUrl: "bg-accessories.png" },
    { name: "Knitwear & Sweaters", handle: "demo-afro-knitwear", mediaUrl: "bg-jackets.png" },
    { name: "Footwear", handle: "demo-afro-footwear", mediaUrl: "bg-accessories.png" },
  ],
  collections: [
    { title: "Women's Collection", handle: "demo-afro-women", mediaUrl: "collection-women.webp" },
    { title: "Men's Collection", handle: "demo-afro-men", mediaUrl: "collection-men.webp" },
    { title: "New Season Arrivals", handle: "demo-afro-new-season", mediaUrl: "collection-new-season.webp" },
    { title: "Archival Sale", handle: "demo-afro-sale", mediaUrl: "collection-archival-sale.webp" },
  ],
  customers: [
    {
      firstName: "Abebe",
      lastName: "Bikila",
      email: "abebe.bikila.afro@example.com",
      phone: "+251911400301",
      area: "Bole",
      address: "Bole Rwanda",
    },
    {
      firstName: "Tigist",
      lastName: "Assefa",
      email: "tigist.assefa.afro@example.com",
      phone: "+251911400302",
      area: "Sarbet",
      address: "Sarbet Pushkin Square",
    },
    {
      firstName: "Kenenisa",
      lastName: "Bekele",
      email: "kenenisa.bekele.afro@example.com",
      phone: "+251911400303",
      area: "Old Airport",
      address: "Old Airport Bisrate Gabriel",
    },
    {
      firstName: "Derartu",
      lastName: "Tulu",
      email: "derartu.tulu.afro@example.com",
      phone: "+251911400304",
      area: "Kazanchis",
      address: "Kazanchis UNECA",
    },
    {
      firstName: "Haile",
      lastName: "Gebrselassie",
      email: "haile.gebrselassie.afro@example.com",
      phone: "+251911400305",
      area: "CMC",
      address: "CMC Tsehay Real Estate",
    },
    {
      firstName: "Meseret",
      lastName: "Defar",
      email: "meseret.defar.afro@example.com",
      phone: "+251911400306",
      area: "Megenagna",
      address: "Megenagna Lem Hotel Area",
    },
    {
      firstName: "Sileshi",
      lastName: "Sihine",
      email: "sileshi.sihine.afro@example.com",
      phone: "+251911400307",
      area: "Piassa",
      address: "Piassa Arada Posta",
    },
    {
      firstName: "Genzebe",
      lastName: "Dibaba",
      email: "genzebe.dibaba.afro@example.com",
      phone: "+251911400308",
      area: "Gotera",
      address: "Gotera Condominium",
    },
  ],
  products: [
    {
      ...singleAxisProduct(
        "Suede Zip Jacket",
        "demo-afro-suede-zip-jacket",
        "outerwear",
        10240,
        "Size",
        ["S", "M", "L", "XL", "XXL"],
        [15, 12, 8, 4, 1], // XXL low stock (1)
        buildRichDescription({
          overview:
            "Precision-crafted from premium full-grain goat suede with a clean minimal point collar, smooth cuprous satin interior lining, and custom brushed gunmetal hardware. Designed for a sharp boxy silhouette that transitions effortlessly across every season.",
          features: [
            "Hand-selected supple Ethiopian goat suede with fine velvet nap",
            "Custom Japanese two-way brushed gunmetal zipper",
            "Dual angled welt hand pockets with hidden snap closures",
            "Interior satin phone pocket with leather reinforced trim",
          ],
          specs: {
            Material: "100% Genuine Goat Suede Leather",
            Lining: "100% Viscose Rayon Satin",
            Fit: "Tailored boxy cut with slight drop shoulder",
            Hardware: "Brushed gunmetal alloy",
          },
          inTheBox: [
            "Suede Zip Jacket",
            "Custom AFRO Studio garment dust cover",
            "Branded cedar wood hanger",
          ],
          note: "Specialist leather dry-clean only. Free size exchanges across Addis Ababa.",
        }),
      ),
      categoryHandle: "demo-afro-jackets",
      collectionHandle: "demo-afro-men",
    },
    {
      ...matrixProduct(
        "Relaxed Wool Trousers",
        "demo-afro-relaxed-wool-trousers",
        "bottoms",
        7850,
        [
          { title: "Size", values: ["S", "M", "L", "XL"] },
          { title: "Color", values: ["Charcoal", "Oatmeal"] },
        ],
        [12, 10, 0, 4, 8, 6, 4, 2], // Charcoal L is SOLD OUT (0)!
        buildRichDescription({
          overview:
            "Tailored with comfortable ease, these relaxed wool trousers feature deep front pleats, slanted side pockets, and an elegant fluid drape suitable for formal occasions and refined street styling alike.",
          features: [
            "Lightweight 260gsm tropical virgin wool with natural stretch",
            "Double forward pleats create an elegant voluminous drape",
            "Adjustable side-waist tabs with brushed silver buckles",
            "Split rear waistband allows for effortless bespoke tailoring",
          ],
          specs: {
            Fabric: "100% Virgin Tropical Wool (260gsm)",
            Rise: "High-rise with relaxed wide straight leg",
            Pockets: "Dual slanted front pockets, dual rear buttoned jetted pockets",
          },
          inTheBox: ["Relaxed Wool Trousers with extra horn replacement button"],
          note: "Charcoal Size L currently sold out. Other sizes available immediately.",
        }),
        {
          swatches: {
            Color: {
              Charcoal: { kind: "color", value: "#334155" },
              Oatmeal: { kind: "color", value: "#E2E8F0" },
            },
          },
        },
      ),
      categoryHandle: "demo-afro-trousers",
      collectionHandle: "demo-afro-men",
    },
    {
      ...singleAxisProduct(
        "Straight-Leg Selvedge Denim Jeans",
        "demo-afro-straight-leg-denim-jeans",
        "bottoms",
        4950,
        "Waist",
        ["30", "32", "34", "36"],
        [14, 10, 8, 4],
        buildRichDescription({
          overview:
            "Classic straight-leg cut crafted on traditional shuttle looms from 14oz heavyweight raw selvedge denim. Finished with authentic red-line selvedge ID, custom copper hardware, and a genuine vegetable-tanned leather back patch.",
          features: [
            "14oz Heavyweight 100% Cotton Raw Selvedge Denim",
            "Authentic red-line selvedge edge visible when cuffed",
            "Custom embossed copper donut button fly and hidden pocket rivets",
            "Will fade uniquely to your personal wear patterns over time",
          ],
          specs: {
            Weft: "Unwashed deep indigo dye over natural ecru yarn",
            Cut: "Mid-rise, straight leg through thigh and knee",
            Patch: "Full-grain debossed cowhide leather patch",
          },
          inTheBox: ["Straight-Leg Selvedge Denim Jeans with Raw Denim Care Booklet"],
          note: "Wear frequently for 6 months before first cold soak to lock in high-contrast fades.",
        }),
      ),
      categoryHandle: "demo-afro-trousers",
      collectionHandle: "demo-afro-men",
    },
    {
      ...singleAxisProduct(
        "Oxford Organic Cotton Shirt",
        "demo-afro-oxford-cotton-shirt",
        "shirts",
        5430,
        "Size",
        ["S", "M", "L", "XL"],
        [16, 12, 8, 3],
        buildRichDescription({
          overview:
            "Woven from pure long-staple organic cotton in a traditional heavy Oxford basketweave. Features a perfectly proportioned button-down collar with natural roll and genuine Australian mother-of-pearl buttons.",
          features: [
            "100% GOTS-Certified Long-Staple Organic Cotton",
            "Substantial 200gsm Oxford cloth that softens with every wash",
            "Genuine Australian mother-of-pearl buttons cross-stitched securely",
            "Box pleat with locker loop for complete freedom of movement",
          ],
          specs: {
            Weave: "Traditional 2x1 Oxford basketweave",
            Collar: "Classic 3.25\" button-down collar with soft unlined interlining",
            Cuffs: "Rounded single-button barrel cuffs",
          },
          inTheBox: ["Oxford Organic Cotton Shirt with spare collar stays and buttons"],
          note: "Machine wash cold with similar colors; warm iron while damp.",
        }),
      ),
      categoryHandle: "demo-afro-shirts",
      collectionHandle: "demo-afro-women",
    },
    {
      ...singleAxisProduct(
        "Utilitarian Overshirt",
        "demo-afro-utilitarian-overshirt",
        "outerwear",
        5990,
        "Size",
        ["S", "M", "L", "XL"],
        [14, 9, 6, 2],
        buildRichDescription({
          overview:
            "A versatile modern layering piece designed with functional utility. Features oversized dual chest bellows pockets, clean concealed horn button placket, and reinforced elbow patches in durable heavy cotton twill.",
          features: [
            "Heavy 310gsm rugged cotton drill twill fabric",
            "Dual military-spec bellows chest pockets with pen slot divider",
            "Concealed button placket prevents snagging",
            "Boxy silhouette layers effortlessly over hoodies, knits, or tees",
          ],
          specs: {
            Fabric: "100% Combed Cotton Heavy Drill Twill",
            Details: "Bar-tack reinforced stress points",
            Fit: "Relaxed overshirt fit (true to size for layering)",
          },
          inTheBox: ["Utilitarian Overshirt"],
          note: "Archival Sale: 20% off regular retail for a limited time.",
        }),
        {
          originalPrice: 7490,
        },
      ),
      categoryHandle: "demo-afro-jackets",
      collectionHandle: "demo-afro-sale",
    },
    {
      ...singleAxisProduct(
        "Camp-Collar Linen Shirt",
        "demo-afro-camp-collar-linen-shirt",
        "shirts",
        4200,
        "Color",
        ["Natural Flax", "Terracotta"],
        [10, 6],
        buildRichDescription({
          overview:
            "Breezy, lightweight camp-collar summer shirt cut from breathable European linen. Enzyme-washed for immediate lived-in softness with a straight hem and side splits designed to be worn untucked.",
          features: [
            "100% Pure European Normandy Flax Linen",
            "Enzyme pre-washed to eliminate shrinkage and maximize drape",
            "Retro Cuban camp collar that lays flat naturally",
            "Corozo nut eco-friendly buttons carved from tagua palm seeds",
          ],
          specs: {
            Weight: "160gsm featherweight breathable linen",
            Cut: "Relaxed summer fit with straight hem and side vents",
          },
          inTheBox: ["Camp-Collar Linen Shirt"],
          note: "Naturally thermoregulating — keeps you cool in warm Ethiopian afternoons.",
        }),
        {
          swatches: {
            Color: {
              "Natural Flax": { kind: "color", value: "#E5E0D8" },
              Terracotta: { kind: "color", value: "#C46210" },
            },
          },
        },
      ),
      categoryHandle: "demo-afro-shirts",
      collectionHandle: "demo-afro-women",
    },
    {
      ...singleAxisProduct(
        "Down Quilted Puffer",
        "demo-afro-down-quilted-puffer",
        "outerwear",
        14800,
        "Size",
        ["S", "M", "L", "XL"],
        [8, 6, 4, 1],
        buildRichDescription({
          overview:
            "Engineered for sub-zero alpine endurance and sleek urban commuting. Filled with ethically sourced 750-fill-power goose down encased in a matte water-repellent micro-ripstop shell with thermal storm cuffs.",
          features: [
            "750 Fill Power RDS-Certified (Responsible Down Standard) Goose Down",
            "Matte Japanese micro-ripstop shell with DWR water-repellent coating",
            "Fleece-lined handwarmer zippered pockets and internal zip chest pocket",
            "Bungee cord adjustable cinch hem blocks freezing drafts",
          ],
          specs: {
            WarmthRating: "Tested down to -15°C",
            Weight: "Ultra-lightweight 580g total jacket weight",
            Zippers: "Two-way YKK VISLON front zipper with storm flap",
          },
          inTheBox: ["Down Quilted Puffer Jacket with waterproof travel pack sac"],
          note: "Special Promotion: Save 3,200 ETB on our flagship winter insulation.",
        }),
        {
          originalPrice: 18000,
        },
      ),
      categoryHandle: "demo-afro-jackets",
      collectionHandle: "demo-afro-sale",
    },
    {
      ...singleAxisProduct(
        "Club Graphic T-Shirt",
        "demo-afro-club-graphic-t-shirt",
        "tops",
        2650,
        "Size",
        ["S", "M", "L", "XL"],
        [20, 15, 10, 5],
        buildRichDescription({
          overview:
            "Everyday classic heavyweight crewneck tee crafted from soft mid-weight 220gsm combed cotton jersey. Features understated tonal heritage embroidery on the chest and minimalist studio typography across the back.",
          features: [
            "220gsm Premium Combed Cotton Jersey with zero transparency",
            "Thick 1.25\" ribbed crewneck collar that holds its shape over time",
            "Pre-shrunk organic cotton fabric for consistent fit wash after wash",
            "Silk-screened water-based graphic print that breathes with the fabric",
          ],
          specs: {
            Fit: "Modern classic fit (slightly relaxed through chest and body)",
            Details: "Double-needle stitching at hem and sleeves",
          },
          inTheBox: ["Club Graphic T-Shirt"],
          note: "Wash cold inside-out. Do not iron directly on print.",
        }),
      ),
      categoryHandle: "demo-afro-tshirts",
      collectionHandle: "demo-afro-new-season",
    },
    {
      ...singleAxisProduct(
        "SST 3-Stripes Tracksuit Set",
        "demo-afro-sst-tracksuit",
        "sets",
        8900,
        "Size",
        ["S", "M", "L", "XL"],
        [12, 10, 6, 3],
        buildRichDescription({
          overview:
            "The iconic athletic silhouette reimagined with modern studio tailoring. Includes matching full-zip track jacket and tapered track pants constructed from smooth recycled tricot fabric with high-contrast engineered 3-stripes.",
          features: [
            "Complete 2-piece set: Track Jacket + Tapered Track Pants",
            "Recycled polyester-cotton heavyweight tricot with soft brushed interior",
            "Ribbed baseball collar, cuffs, and hem on jacket",
            "Pants feature elasticated drawstring waistband and concealed ankle zip vents",
          ],
          specs: {
            Material: "60% Recycled Polyester, 40% Cotton Tricot",
            Zippers: "Concealed coil zippers on all jacket and pant pockets",
          },
          inTheBox: [
            "SST Track Jacket",
            "SST Tapered Track Pants",
          ],
          note: "Sold as a matched 2-piece set. True to size athletic taper.",
        }),
      ),
      categoryHandle: "demo-afro-sets",
      collectionHandle: "demo-afro-men",
    },
    // LOW STOCK TEST CASE
    {
      ...singleAxisProduct(
        "Sherpa Corduroy Jacket",
        "demo-afro-sherpa-corduroy-jacket",
        "outerwear",
        11500,
        "Size",
        ["S", "M", "L", "XL"],
        [2, 1, 1, 1], // Only 1-2 units left per size!
        buildRichDescription({
          overview:
            "A rugged vintage workwear classic modernized. Built with heavyweight 8-wale chunky corduroy and fully lined throughout the body and collar with thick, plush cream sherpa fleece for substantial warmth.",
          features: [
            "Heavyweight 8-wale 100% cotton ridge corduroy exterior",
            "High-pile 350gsm plush faux-sherpa fleece thermal body lining",
            "Quilted insulated satin sleeve lining for easy glide over sweaters",
            "Antiqued brass rivet buttons and reinforced patch chest flap pockets",
          ],
          specs: {
            Shell: "100% Heavy Cotton Corduroy",
            BodyLining: "100% Poly Sherpa Fleece (High Thermal Retention)",
            Care: "Dry clean or gentle cold machine wash inside out",
          },
          inTheBox: ["Sherpa Corduroy Jacket"],
          note: "Low Stock: Less than 2 units remaining per size! Hand-finished studio release.",
        }),
      ),
      categoryHandle: "demo-afro-jackets",
      collectionHandle: "demo-afro-men",
    },
    {
      ...singleAxisProduct(
        "Tailored Pleat Trousers",
        "demo-afro-tailored-pleat-trousers",
        "bottoms",
        7120,
        "Size",
        ["S", "M", "L", "XL"],
        [11, 8, 5, 2],
        buildRichDescription({
          overview:
            "Sophisticated bespoke-inspired tailored trousers crafted with razor-sharp pressed front creases, double reverse pleats, and an adjustable side-tab waistband that eliminates the need for a belt.",
          features: [
            "Crease-resistant blend of virgin wool and recycled stretch fibers",
            "Internal curtain waistband construction prevents shirt untucking",
            "Deep jetted side pockets and blind-stitched clean hem",
            "Unfinished 34\" inseam allows for custom cuffing or tailoring",
          ],
          specs: {
            Material: "55% Polyester, 43% Wool, 2% Elastane",
            Fit: "Tapered tailored fit with clean silhouette break",
          },
          inTheBox: ["Tailored Pleat Trousers"],
          note: "Dry clean recommended to preserve crisp razor creases.",
        }),
      ),
      categoryHandle: "demo-afro-trousers",
      collectionHandle: "demo-afro-women",
    },
    {
      ...singleAxisProduct(
        "Leather Crossbody Pouch",
        "demo-afro-leather-crossbody-pouch",
        "accessories",
        6200,
        "Color",
        ["Black", "Espresso Brown"],
        [12, 8],
        buildRichDescription({
          overview:
            "Handcrafted in Addis Ababa from vegetable-tanned Ethiopian highland nappa leather. Features a minimalist rounded silhouette, hand-knotted tubular leather strap, and a polished silver Swiss metal zipper.",
          features: [
            "100% Vegetable-tanned Ethiopian highland sheepskin nappa leather",
            "Develops an extraordinary rich natural patina over time",
            "Hand-knotted tubular leather strap adjustable to chest or hip height",
            "Accommodates all modern smartphone models, passport, cards, and keys",
          ],
          specs: {
            Dimensions: "21cm x 15cm x 4cm",
            StrapDrop: "55cm (Adjustable via knot)",
            Lining: "Natural organic unbleached cotton twill",
          },
          inTheBox: [
            "Leather Crossbody Pouch",
            "Organic cotton drawstring protective dust bag",
          ],
          note: "Handmade in small artisan batches in Addis Ababa.",
        }),
        {
          swatches: {
            Color: {
              Black: { kind: "color", value: "#000000" },
              "Espresso Brown": { kind: "color", value: "#3B2F2F" },
            },
          },
        },
      ),
      categoryHandle: "demo-afro-accessories",
      collectionHandle: "demo-afro-new-season",
    },
    // SINGLE-IMAGE TEST CASE
    {
      ...singleAxisProduct(
        "Cotton Minimalist Beanie",
        "demo-afro-cotton-minimalist-beanie",
        "accessories",
        1850,
        "Color",
        ["Black", "Olive"],
        [25, 20],
        buildRichDescription({
          overview:
            "A low-profile watch cap beanie knit from breathable 100% organic combed cotton in a chunky 7-gauge fisherman rib. Features a snug fold-over cuff and subtle tonal embroidered logo label.",
          features: [
            "100% Organic Combed Cotton (Zero itch, all-day comfort)",
            "Chunky 7-gauge fisherman rib knit for optimal stretch recovery",
            "Classic shallow watch cap profile fits cleanly above the ears",
            "Double-layer foldover cuff for extra ear warmth",
          ],
          specs: {
            Material: "100% Organic Cotton",
            Sizing: "One size fits all (Unisex stretch)",
          },
          inTheBox: ["Cotton Minimalist Beanie"],
          note: "Hand wash cold; lay flat to dry.",
        }),
        {
          swatches: {
            Color: {
              Black: { kind: "color", value: "#000000" },
              Olive: { kind: "color", value: "#556B2F" },
            },
          },
        },
      ),
      categoryHandle: "demo-afro-accessories",
      collectionHandle: "demo-afro-new-season",
    },
    // SINGLE-IMAGE TEST CASE
    {
      ...singleAxisProduct(
        "Essential Everyday Tote",
        "demo-afro-essential-everyday-tote",
        "accessories",
        4500,
        "Color",
        ["Black", "Raw Canvas"],
        [18, 14],
        buildRichDescription({
          overview:
            "Constructed from 18oz heavy-duty waterproof ballistic canvas with reinforced full-grain leather dual carry handles and an internal padded sleeve tailored for up to 16-inch laptops.",
          features: [
            "18oz Heavyweight Ballistic Duck Canvas with water-resistant wax coating",
            "Bridle leather shoulder handles with reinforced brass rivet anchors",
            "Internal padded laptop compartment fits up to 16\" MacBook Pro",
            "Magnetic snap main closure with quick-access interior phone pocket",
          ],
          specs: {
            Capacity: "24 Liters",
            Dimensions: "42cm x 36cm x 15cm",
            HandleDrop: "28cm (Comfortable shoulder carry over thick coats)",
          },
          inTheBox: ["Essential Everyday Canvas Tote"],
          note: "Built for decades of daily market, work, and travel utility.",
        }),
        {
          swatches: {
            Color: {
              Black: { kind: "color", value: "#000000" },
              "Raw Canvas": { kind: "color", value: "#F5F5DC" },
            },
          },
        },
      ),
      categoryHandle: "demo-afro-accessories",
      collectionHandle: "demo-afro-new-season",
    },
    // MULTI-AXIS + PARTIALLY SOLD OUT TEST CASE (Washed Black Size M = 0 stock!)
    {
      ...matrixProduct(
        "Heavyweight Boxy Tee 280gsm",
        "demo-afro-heavyweight-boxy-tee",
        "tops",
        3450,
        [
          { title: "Size", values: ["S", "M", "L", "XL"] },
          { title: "Color", values: ["Off-White", "Washed Black", "Vintage Sage"] },
        ],
        // Washed Black (index 1) Size M (index 1) = index 4 => stock 0!
        [15, 12, 8, 4, 12, 0, 6, 2, 10, 8, 5, 2],
        buildRichDescription({
          overview:
            "The quintessential streetwear tee. Custom knitted from a hefty 280gsm organic combed cotton with a substantial high-density collar, exaggerated dropped shoulders, and a clean wide boxy drape.",
          features: [
            "Ultra-heavy 280gsm 100% Organic Combed Cotton",
            "Dense 1.5\" binded rib collar that never sags or bacon-necks",
            "Boxy modern oversized drape with dropped shoulder line",
            "Garment-dyed and enzyme-washed for deep dimensional vintage tones",
          ],
          specs: {
            Weight: "280gsm (Heavyweight)",
            Yarn: "16-single open-end cotton for authentic vintage hand-feel",
            Fit: "Oversized boxy fit (order true size for boxy fit, size down for regular)",
          },
          inTheBox: ["Heavyweight Boxy Tee 280gsm"],
          note: "Washed Black Size M currently sold out. Other sizes and colors available.",
        }),
        {
          swatches: {
            Color: {
              "Off-White": { kind: "color", value: "#FAF9F6" },
              "Washed Black": { kind: "color", value: "#1A1A1A" },
              "Vintage Sage": { kind: "color", value: "#8A9A86" },
            },
          },
        },
      ),
      categoryHandle: "demo-afro-tshirts",
      collectionHandle: "demo-afro-new-season",
    },
    {
      ...singleAxisProduct(
        "Structured Merino Knit Cardigan",
        "demo-afro-structured-knit-cardigan",
        "knitwear",
        9950,
        "Size",
        ["S", "M", "L", "XL"],
        [10, 7, 4, 1],
        buildRichDescription({
          overview:
            "Chunky 5-gauge cardigan spun from 100% extra-fine Australian merino wool. Finished with genuine polished buffalo horn buttons, deep patch front pockets, and a substantial folded shawl collar.",
          features: [
            "100% Extra-Fine Merino Wool (19.5 Micron - ultra-soft next-to-skin)",
            "Heavy 5-gauge cardigan rib knit with substantial thermal weight",
            "Genuine buffalo horn buttons with natural subtle grain variance",
            "Dual deep waist patch pockets with reinforced ribbed openings",
          ],
          specs: {
            Weight: "Heavyweight winter knit (Approx 750g)",
            Buttons: "Genuine Buffalo Horn (Carved)",
            Care: "Hand wash in cool water with wool detergent; dry flat",
          },
          inTheBox: ["Structured Merino Knit Cardigan with spare horn button"],
          note: "On Sale: Save 1,850 ETB. The definitive cozy luxury winter piece.",
        }),
        {
          originalPrice: 11800,
        },
      ),
      categoryHandle: "demo-afro-knitwear",
      collectionHandle: "demo-afro-sale",
    },
  ],
};
