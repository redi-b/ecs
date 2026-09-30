import { buildRichDescription, matrixProduct, singleAxisProduct, singleVariantProduct } from "./catalog-builders.js";
import type { DemoShopDefinition } from "./types.js";

/** Tech shop — phones, laptops, audio, accessories. Handle has no dashes. */
export const techShop: DemoShopDefinition = {
  ids: {
    tenant: "d1000000-0000-4000-8000-000000000001",
    domain: "d1000000-0000-4000-8000-000000000002",
    user: "d1000000-0000-4000-8000-000000000003",
    account: "d1000000-0000-4000-8000-000000000003:credential",
    membership: "d1000000-0000-4000-8000-000000000004",
    onboarding: "d1000000-0000-4000-8000-000000000005",
    storefrontRevision: "d1000000-0000-4000-8000-000000000006",
    storefrontConfig: "d1000000-0000-4000-8000-000000000007",
  },
  templateKey: "nexahub@1",
  tenant: {
    handle: "addistech",
    name: "Addis Tech Hub",
  },
  user: {
    email: "yonatan@addistech.ecs.et",
    name: "Yonatan Bekele",
    phone: "+251911100001",
  },
  paymentOnboarding: {
    status: "not_configured",
    notes: "Demo shop — Chapa not connected (COD only).",
  },
  shopDetails: {
    version: 1,
    categories: ["Electronics", "Technology"],
    description:
      "Addis Tech Hub is your one-stop destination for premium electronics, smartphones, laptops, and accessories in Addis Ababa. We source the best global tech brands and provide reliable local warranty and support.",
    primaryPhone: "+251911100001",
    additionalPhones: ["+251922200001"],
    publicEmail: "info@addistechhub.com",
    address: {
      city: "Addis Ababa",
      streetAddress: "Bole Road, Friendship Business Center, 4th Floor, Suite 401",
      directions: "Near Bole Airport, opposite Friendship Hotel",
    },
    socialProfiles: [
      { platform: "instagram", url: "https://www.instagram.com/addistechhub" },
      { platform: "facebook", url: "https://www.facebook.com/addistechhub" },
      { platform: "telegram", url: "https://t.me/addistechhub" },
      { platform: "tiktok", url: "https://www.tiktok.com/@addistechhub" },
    ],
  },
  categories: [
    { name: "Phones", handle: "demo-tech-phones", mediaUrl: "category-phones.webp" },
    {
      name: "Android",
      handle: "demo-tech-phones-android",
      parentHandle: "demo-tech-phones",
      mediaUrl: "category-phones.webp",
    },
    {
      name: "Apple",
      handle: "demo-tech-phones-apple",
      parentHandle: "demo-tech-phones",
      mediaUrl: "category-phones.webp",
    },
    { name: "Laptops", handle: "demo-tech-laptops", mediaUrl: "category-laptops.webp" },
    {
      name: "Windows",
      handle: "demo-tech-laptops-windows",
      parentHandle: "demo-tech-laptops",
      mediaUrl: "category-laptops.webp",
    },
    {
      name: "Mac",
      handle: "demo-tech-laptops-mac",
      parentHandle: "demo-tech-laptops",
      mediaUrl: "category-laptops.webp",
    },
    { name: "Audio", handle: "demo-tech-audio", mediaUrl: "category-audio.webp" },
    { name: "Accessories", handle: "demo-tech-accessories", mediaUrl: "category-accessories.webp" },
  ],
  collections: [
    { title: "Best Sellers", handle: "demo-tech-best-sellers", mediaUrl: "collection-best-sellers.webp" },
    { title: "New Arrivals", handle: "demo-tech-new-arrivals", mediaUrl: "collection-new-arrivals.webp" },
    { title: "Work From Home", handle: "demo-tech-wfh", mediaUrl: "collection-wfh.webp" },
    { title: "Clearance & Deals", handle: "demo-tech-deals", mediaUrl: "collection-deals.webp" },
  ],
  customers: [
    {
      firstName: "Abel",
      lastName: "Tesfaye",
      email: "abel.tesfaye.tech@example.com",
      phone: "+251911200101",
      area: "Bole",
      address: "Bole Medhanialem",
    },
    {
      firstName: "Sara",
      lastName: "Haile",
      email: "sara.haile.tech@example.com",
      phone: "+251911200102",
      area: "Kazanchis",
      address: "Kazanchis Business District",
    },
    {
      firstName: "Daniel",
      lastName: "Mekonnen",
      email: "daniel.mekonnen.tech@example.com",
      phone: "+251911200103",
      area: "CMC",
      address: "CMC Michael",
    },
    {
      firstName: "Hiwot",
      lastName: "Alemu",
      email: "hiwot.alemu.tech@example.com",
      phone: "+251911200104",
      area: "Piassa",
      address: "Arada Piassa",
    },
    {
      firstName: "Yared",
      lastName: "Girma",
      email: "yared.girma.tech@example.com",
      phone: "+251911200105",
      area: "Megenagna",
      address: "Megenagna Zefmesh",
    },
    {
      firstName: "Betty",
      lastName: "Assefa",
      email: "betty.assefa.tech@example.com",
      phone: "+251911200106",
      area: "Sarbet",
      address: "Sarbet Roundabout",
    },
    {
      firstName: "Kalkidan",
      lastName: "Wondimu",
      email: "kalkidan.wondimu.tech@example.com",
      phone: "+251911200107",
      area: "Ayat",
      address: "Ayat Square",
    },
    {
      firstName: "Mikiyas",
      lastName: "Tadesse",
      email: "mikiyas.tadesse.tech@example.com",
      phone: "+251911200108",
      area: "Mexico",
      address: "Mexico Square",
    },
    {
      firstName: "Eyerusalem",
      lastName: "Kassa",
      email: "eyerusalem.kassa.tech@example.com",
      phone: "+251911200109",
      area: "Gerji",
      address: "Gerji Mebrat Hail",
    },
  ],
  products: [
    {
      ...singleAxisProduct(
        "A35 5G Smartphone",
        "demo-tech-galaxy-a35",
        "phones",
        28900,
        "Color",
        ["Awesome Navy", "Awesome Iceblue"],
        [24, 8],
        buildRichDescription({
          overview:
            "The A35 5G brings flagship-tier performance to an accessible form factor. Built with a vivid 120Hz Super AMOLED display, premium glass back design, and versatile 50MP optical image stabilization triple camera system.",
          features: [
            "6.6-inch Super AMOLED FHD+ display with 120Hz high refresh rate",
            "50MP Main Camera with Optical Image Stabilization (OIS) for blur-free low-light photos",
            "5,000mAh two-day battery life with 25W Fast Charging support",
            "IP67 dust and water resistance for peace of mind in any weather",
          ],
          specs: {
            Display: '6.6" Super AMOLED, 1080 x 2340, 120Hz, 1000 nits',
            Processor: "Octa-core 5G SoC",
            RAM: "8GB",
            Storage: "128GB / 256GB (microSD expandable up to 1TB)",
            Battery: "5000 mAh",
            OS: "Android with 4 generations of OS upgrades guaranteed",
          },
          inTheBox: [
            "A35 5G Smartphone",
            "USB-C to USB-C Data & Charging Cable",
            "SIM Tray Ejection Pin",
            "Quick Start Guide & Warranty Card",
          ],
          note: "Includes official 1-Year Addis Tech warranty. Same-day delivery across Addis Ababa.",
        }),
        {
          swatches: {
            Color: {
              "Awesome Navy": { kind: "color", value: "#0F172A" },
              "Awesome Iceblue": { kind: "color", value: "#BAE6FD" },
            },
          },
        },
      ),
      categoryHandle: "demo-tech-phones-android",
      collectionHandle: "demo-tech-best-sellers",
    },
    {
      ...singleAxisProduct(
        'Refurbished 6.1" Smartphone',
        "demo-tech-iphone-13",
        "phones",
        42500,
        "Color",
        ["Midnight", "Starlight"],
        [6, 2],
        buildRichDescription({
          overview:
            "Certified Grade-A refurbished 6.1-inch flagship. Inspected through a comprehensive 65-point hardware diagnostic test, guaranteed 100% original parts, and 90%+ battery health with pristine cosmetic condition.",
          features: [
            "Super Retina XDR OLED display with Ceramic Shield front protection",
            "Cinematic mode in 1080p at 30 fps with automatic shallow depth of field",
            "Advanced dual-camera system with Sensor-shift Optical Image Stabilization",
            "A15 Bionic chip for lightning-fast performance and efficiency",
          ],
          specs: {
            Screen: '6.1" Super Retina XDR OLED, HDR10',
            Condition: "Certified Grade-A (Like New, 90%+ Battery Health)",
            Storage: "128GB NVMe",
            Connectivity: "5G, Wi-Fi 6, Bluetooth 5.0, NFC",
            Security: "Face ID facial biometric authentication",
          },
          inTheBox: [
            'Certified Refurbished 6.1" Smartphone',
            "Braided USB-C to Lightning Fast Charging Cable",
            "Quality Inspection Certificate",
            "6-Month Replacement Warranty Document",
          ],
          note: "On Sale! Save 7,400 ETB. Rigorously tested and certified.",
        }),
        {
          originalPrice: 49900,
          swatches: {
            Color: {
              Midnight: { kind: "color", value: "#1E293B" },
              Starlight: { kind: "color", value: "#F8FAFC" },
            },
          },
        },
      ),
      categoryHandle: "demo-tech-phones-apple",
      collectionHandle: "demo-tech-deals",
    },
    {
      ...singleAxisProduct(
        "Note 13 Android Phone",
        "demo-tech-redmi-note-13",
        "phones",
        18900,
        "Config",
        ["8GB / 256GB", "12GB / 512GB"],
        [30, 12],
        buildRichDescription({
          overview:
            "The standard in modern mid-range smartphones. Featuring a stunning 108MP triple camera array, ultra-slim symmetric bezels, and 33W fast charging inside an ultra-thin 7.9mm body.",
          features: [
            "Ultra-clear 108MP main camera with 3x in-sensor lossless zoom",
            "120Hz FHD+ AMOLED display with in-screen fingerprint sensor",
            "Dual stereo speakers with Dolby Atmos support",
            "Robust 5000mAh battery with 33W fast charger included in box",
          ],
          specs: {
            Camera: "108MP (wide) + 8MP (ultrawide) + 2MP (macro)",
            Screen: '6.67" AMOLED, 120Hz, 1800 nits peak brightness',
            Battery: "5000mAh with 33W in-box charger",
            Audio: "3.5mm Headphone Jack + Dual Stereo Speakers",
          },
          inTheBox: [
            "Note 13 Smartphone",
            "33W Power Adapter",
            "USB-C Cable",
            "Protective Soft Clear Case",
            "Screen Protector (Pre-applied)",
          ],
          note: "Cash on delivery available with instant dispatch across Addis Ababa.",
        }),
      ),
      categoryHandle: "demo-tech-phones-android",
      collectionHandle: "demo-tech-new-arrivals",
    },
    {
      ...singleAxisProduct(
        'E14 14" Business Laptop',
        "demo-tech-thinkpad-e14",
        "laptops",
        68900,
        "Config",
        ["i5 16GB / 512GB", "i7 32GB / 1TB"],
        [8, 2],
        buildRichDescription({
          overview:
            "Engineered for demanding enterprise workloads. The E14 combines legendary durability, military-grade MIL-STD-810H toughness, and all-day battery life with an industry-leading ergonomic tactile keyboard.",
          features: [
            "13th Gen Intel Core processor with Iris Xe high-performance graphics",
            '14-inch IPS anti-glare FHD display with 300 nits brightness',
            "Biometric power-button fingerprint reader & physical webcam privacy shutter",
            "Full enterprise I/O: Thunderbolt 4, HDMI 2.1, RJ45 Ethernet, and USB-A",
          ],
          specs: {
            Chassis: "Anodized Aluminum top cover, MIL-STD-810H certified",
            Display: '14.0" WUXGA (1920 x 1200) IPS, Anti-Glare',
            Ports: "1x Thunderbolt 4, 1x USB-C 3.2, 1x USB-A 3.2, 1x HDMI 2.1, RJ-45",
            Battery: "57Wh with 65W Rapid Charge (80% in 60 mins)",
            Keyboard: "Backlit, spill-resistant with TrackPoint and glass-feel trackpad",
          },
          inTheBox: [
            'E14 14" Business Laptop',
            "65W USB-C GaN AC Power Adapter",
            "Quick Setup & User Guide",
          ],
          note: "Backed by 1-year hardware warranty. Free setup & software installation support.",
        }),
      ),
      categoryHandle: "demo-tech-laptops-windows",
      collectionHandle: "demo-tech-wfh",
    },
    {
      ...singleAxisProduct(
        'M1 13" Ultralight Laptop',
        "demo-tech-mba-m1",
        "laptops",
        79500,
        "Config",
        ["8GB / 256GB", "16GB / 512GB"],
        [5, 1],
        buildRichDescription({
          overview:
            "Remarkably thin and fast. Engineered with the groundbreaking M1 chip featuring an 8-core CPU and completely fanless, silent architecture that delivers up to 18 hours of continuous battery life.",
          features: [
            "Apple M1 chip with 8-core CPU and 7-core GPU for breakthrough performance",
            "Fanless design for completely silent operation even under sustained workloads",
            '13.3-inch Retina display with P3 wide color gamut for true-to-life vibrant images',
            "Up to 18 hours of battery endurance on a single charge",
          ],
          specs: {
            Processor: "Apple M1 8-core CPU with 4 performance cores & 4 efficiency cores",
            Display: '13.3" LED-backlit Retina display, 2560 x 1600, 400 nits',
            Memory: "Unified Memory (8GB / 16GB)",
            Storage: "Ultrafast NVMe SSD",
            Weight: "1.29 kg (2.8 pounds)",
          },
          inTheBox: [
            'M1 13" Ultralight Laptop',
            "30W USB-C Power Adapter",
            "USB-C Charge Cable (2m)",
          ],
          note: "Special Promotion: Save 20,000 ETB! Pristine condition with complete accessories.",
        }),
        {
          originalPrice: 99500,
        },
      ),
      categoryHandle: "demo-tech-laptops-mac",
      collectionHandle: "demo-tech-deals",
    },
    // Multi-axis: color × case (exercises product picker axes).
    {
      ...matrixProduct(
        "Wireless Earbuds Pro",
        "demo-tech-earbuds-pro",
        "audio",
        4200,
        [
          { title: "Color", values: ["Matte Black", "Glacier White"] },
          { title: "Case", values: ["Standard Case", "Wireless Qi Case"] },
        ],
        [25, 10, 3, 0],
        buildRichDescription({
          overview:
            "Immersive pro-grade acoustics in an ergonomic compact form factor. Features hybrid active noise cancellation, transparency pass-through mode, and custom dynamic audio drivers for punchy bass and crystalline highs.",
          features: [
            "Hybrid Active Noise Cancellation blocks up to 40dB of ambient city noise",
            "Ambient Transparency Mode lets you hear surroundings naturally with a single tap",
            "6-Mic array with beamforming AI algorithms for studio-clear voice calls",
            "Up to 32 hours total playback with charging case (8 hours per single charge)",
          ],
          specs: {
            Bluetooth: "5.3 with AAC and LDAC high-res codec support",
            Driver: "11mm titanium-coated dynamic neodymium drivers",
            Waterproof: "IPX5 sweat and splash resistance",
            Latency: "Ultra-low 65ms gaming mode",
          },
          inTheBox: [
            "Earbuds Pro (Left & Right)",
            "Pocket Charging Case",
            "3 Pairs Silicone Ear Tips (S / M / L)",
            "Braided USB-C Charging Cable",
          ],
          note: "Compatible with iOS, Android, macOS, and Windows devices.",
        }),
        {
          swatches: {
            Color: {
              "Matte Black": { kind: "color", value: "#1E293B" },
              "Glacier White": { kind: "color", value: "#F8FAFC" },
            },
          },
        },
      ),
      categoryHandle: "demo-tech-audio",
      collectionHandle: "demo-tech-best-sellers",
    },
    {
      ...singleAxisProduct(
        "Over-Ear Studio Headphones",
        "demo-tech-studio-headphones",
        "audio",
        6800,
        "Color",
        ["Matte Black", "Navy Blue"],
        [14, 7],
        buildRichDescription({
          overview:
            "Engineered for audio purists and focused productivity. Featuring custom 40mm tuned drivers, plush memory foam acoustic seals, and up to 50 hours of wireless high-fidelity battery life on a single charge.",
          features: [
            "Advanced Active Noise Cancellation with dual acoustic sensors",
            "40mm High-Resolution audio certified dynamic drivers",
            "Supreme comfort: ultra-soft protein leather ear cushions and lightweight headband",
            "Multipoint connection: seamlessly switch between phone and laptop simultaneously",
          ],
          specs: {
            Battery: "50 hours (ANC Off) / 38 hours (ANC On)",
            FastCharge: "10 minutes charge = 5 hours playtime",
            Connectivity: "Bluetooth 5.3 + 3.5mm AUX analog cable included",
            Weight: "245g",
          },
          inTheBox: [
            "Over-Ear Studio Headphones",
            "Hard EVA Travel Protective Case",
            "3.5mm Gold-Plated Audio Cable",
            "USB-C Charging Cable",
            "Airplane Flight Adapter",
          ],
          note: "Save 2,100 ETB for a limited time. Genuine studio sound guarantee.",
        }),
        {
          originalPrice: 8900,
          swatches: {
            Color: {
              "Matte Black": { kind: "color", value: "#0F172A" },
              "Navy Blue": { kind: "color", value: "#1E3A8A" },
            },
          },
        },
      ),
      categoryHandle: "demo-tech-audio",
      collectionHandle: "demo-tech-deals",
    },
    // Single-variant / zero-option product (SINGLE-IMAGE TEST CASE)
    {
      ...singleVariantProduct(
        "65W GaN Dual Port Charger",
        "demo-tech-gan-charger",
        "accessories",
        1800,
        45,
        buildRichDescription({
          overview:
            "Harnessing next-generation Gallium Nitride (GaN III) semiconductor tech. Replaces bulky power bricks with a pocket-sized powerhouse capable of fast-charging laptops, tablets, and phones simultaneously.",
          features: [
            "65W Max Power Delivery 3.0 output via USB-C port",
            "Dual-port charging: USB-C (65W) + USB-A (18W Quick Charge 3.0)",
            "50% smaller than standard 60W laptop silicon power bricks",
            "Comprehensive MultiProtect safety: temperature control & surge prevention",
          ],
          specs: {
            TotalOutput: "65W Max",
            Input: "AC 100-240V, 50/60Hz (Universal travel voltage)",
            Dimensions: "52 x 52 x 30 mm",
            Weight: "110g",
          },
          inTheBox: [
            "65W GaN Dual Port Wall Charger",
            "Instruction & Safety Manual",
          ],
          note: "Universal compatibility: charges MacBooks, ThinkPads, iPhones, and Android.",
        }),
      ),
      categoryHandle: "demo-tech-accessories",
      collectionHandle: "demo-tech-new-arrivals",
    },
    {
      ...singleAxisProduct(
        "USB-C Hub 7-in-1 Aluminum Dock",
        "demo-tech-usb-c-hub",
        "accessories",
        2400,
        "Finish",
        ["Space Grey", "Silver"],
        [22, 9],
        buildRichDescription({
          overview:
            "Expand your USB-C laptop into a full workstation with a single plug. Features crystal-clear 4K 60Hz HDMI video output, 100W Power Delivery pass-through charging, high-speed USB 3.0, and SD card readers.",
          features: [
            "4K HDMI Port supporting up to 3840x2160 @ 60Hz display",
            "100W USB-C Power Delivery pass-through charging port",
            "3x USB-A 3.0 ports with up to 5Gbps fast data transfer speeds",
            "Simultaneous SD and MicroSD UHS-I high-speed card readers",
          ],
          specs: {
            Material: "Unibody aerospace-grade heat-dissipating aluminum alloy",
            Cable: "Reinforced nylon braided cable with strain-relief collar",
            Weight: "75g",
            Compatibility: "macOS, Windows 11/10, ChromeOS, iPadOS",
          },
          inTheBox: [
            "7-in-1 USB-C Hub Adapter",
            "Travel Velvet Pouch",
            "User Guide",
          ],
          note: "Plug-and-play simplicity. No driver installation required.",
        }),
        {
          swatches: {
            Finish: {
              "Space Grey": { kind: "color", value: "#475569" },
              Silver: { kind: "color", value: "#E2E8F0" },
            },
          },
        },
      ),
      categoryHandle: "demo-tech-accessories",
      collectionHandle: "demo-tech-wfh",
    },
    // Single-variant / zero-option product (SINGLE-IMAGE TEST CASE)
    {
      ...singleVariantProduct(
        'Hard-Shell Laptop Sleeve 14"',
        "demo-tech-laptop-sleeve",
        "accessories",
        950,
        35,
        buildRichDescription({
          overview:
            "Engineered 360-degree corner drop defense in an ultra-slim silhouette. Features high-density shock-absorbing memory foam, water-resistant ballistic canvas, and a super-soft plush fleece interior.",
          features: [
            "CornerArmor reinforced shock-absorbing bumper zones",
            "Spill-resistant durable recycled woven canvas exterior",
            "Thick 3D faux-fur lining prevents scratches and dust accumulation",
            "Heavy-duty Japanese YKK water-sealed exterior zipper",
          ],
          specs: {
            Fit: '13" to 14" laptops (MacBook Pro/Air 13/14, ThinkPad X1/E14, Dell XPS 13)',
            ExternalDimensions: "340 x 245 x 25 mm",
            InternalDimensions: "325 x 230 x 18 mm",
            Weight: "210g",
          },
          inTheBox: ['14" Protective Laptop Sleeve'],
          note: "Fits inside any standard backpack or briefcase effortlessly.",
        }),
      ),
      categoryHandle: "demo-tech-accessories",
      collectionHandle: "demo-tech-wfh",
    },
    {
      ...singleAxisProduct(
        "Bluetooth Speaker Mini",
        "demo-tech-bt-speaker",
        "audio",
        2100,
        "Color",
        ["Charcoal", "Sage Green"],
        [16, 4],
        buildRichDescription({
          overview:
            "Big sound in the palm of your hand. Delivers surprisingly punchy 360-degree room-filling acoustic bass and clear vocals, wrapped in rugged waterproof fabric ready for home, office, or outdoor adventures.",
          features: [
            "360-degree immersive acoustic dispersion with passive bass radiator",
            "IPX7 fully submersible waterproof and dustproof construction",
            "Up to 14 hours playtime with rechargeable lithium battery",
            "True Wireless Stereo (TWS): pair two units together for wireless stereo sound",
          ],
          specs: {
            PowerOutput: "10W RMS",
            BatteryCapacity: "2500 mAh",
            ChargingTime: "2.5 hours via USB-C",
            Bluetooth: "5.3 (Up to 20m range)",
          },
          inTheBox: [
            "Bluetooth Speaker Mini",
            "Tear-Resistant Lanyard Strap",
            "USB-C Charging Cable",
            "Quick User Guide",
          ],
          note: "Rugged and compact. Perfect for room listening and travel.",
        }),
        {
          swatches: {
            Color: {
              Charcoal: { kind: "color", value: "#334155" },
              "Sage Green": { kind: "color", value: "#4D7C0F" },
            },
          },
        },
      ),
      categoryHandle: "demo-tech-audio",
      collectionHandle: "demo-tech-best-sellers",
    },
    {
      ...singleAxisProduct(
        "Power Bank 20000mAh",
        "demo-tech-powerbank-20k",
        "accessories",
        2600,
        "Model",
        ["Standard 18W", "PD Fast 30W"],
        [28, 6],
        buildRichDescription({
          overview:
            "Never worry about dead batteries again. High-density 20,000mAh lithium-polymer cells capable of charging a modern smartphone 4-5 times over, equipped with a crisp digital smart display.",
          features: [
            "Colossal 20,000mAh capacity airline-approved flight-safe battery",
            "High-speed Power Delivery charges smartphones to 55% in just 30 minutes",
            "Intelligent LED display shows exact real-time remaining battery percentage",
            "Triple output: charge up to 3 devices simultaneously",
          ],
          specs: {
            Capacity: "20,000mAh / 74Wh (TSA Carry-On Approved)",
            Ports: "1x USB-C In/Out, 2x USB-A Out",
            Input: "USB-C 18W Fast Recharge",
            Weight: "385g",
          },
          inTheBox: [
            "20,000mAh Digital Power Bank",
            "USB-C to USB-C Fast Charging Cable",
            "User Guide",
          ],
          note: "High safety rating: UL and CE certified battery protection.",
        }),
      ),
      categoryHandle: "demo-tech-accessories",
      collectionHandle: "demo-tech-new-arrivals",
    },
    // COMPLETELY SOLD OUT PRODUCT TEST CASE
    {
      ...singleAxisProduct(
        "Pro Max Titanium Smartphone",
        "demo-tech-pro-max-titanium",
        "phones",
        88000,
        "Storage",
        ["256GB", "512GB", "1TB"],
        [0, 0, 0], // Completely 0 stock on all variants!
        buildRichDescription({
          overview:
            "The pinnacle of mobile engineering. Precision-forged with Grade 5 aerospace titanium, customizable Action button, professional studio 48MP camera system, and the next-generation 3nm desktop-class processor.",
          features: [
            "Aerospace-grade titanium frame with textured matte-glass back",
            "Super Retina XDR display with ProMotion 120Hz and Always-On display",
            "48MP Main Camera with 5x optical telephoto periscope zoom lens",
            "Industry-first hardware-accelerated ray tracing mobile graphics",
          ],
          specs: {
            Display: '6.7" Super Retina XDR OLED, 120Hz ProMotion, 2000 nits',
            Chip: "3-nanometer Desktop Architecture SoC",
            Body: "Grade 5 Titanium + Ceramic Shield front",
            Port: "USB-C with USB 3 speeds (up to 10Gbps)",
          },
          inTheBox: [
            "Pro Max Titanium Smartphone",
            "Braided USB-C Charge Cable",
            "Documentation",
          ],
          note: "Currently SOLD OUT due to unprecedented demand. Join the waitlist for restock notification.",
        }),
      ),
      categoryHandle: "demo-tech-phones-apple",
      collectionHandle: "demo-tech-best-sellers",
    },
  ],
};
