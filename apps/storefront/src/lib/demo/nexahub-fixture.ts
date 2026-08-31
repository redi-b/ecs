import laptop from "../../templates/nexahub/v1/assets/laptop-connectivity-category.webp";
import phone from "../../templates/nexahub/v1/assets/product-quality-phone-promo.webp";
import peripheral from "../../templates/nexahub/v1/assets/peripheral-devices-category.webp";
import featured from "../../templates/nexahub/v1/assets/featured-item-promo.webp";
import type { StoreCart, StoreCategory, StoreCollection, StoreDeliveryOptions, StoreProduct, StoreShippingOption } from "../commerce/types";
import type { LastOrderCookie } from "../session/cart-cookie";

export const nexahubDemoCollections: StoreCollection[] = [
  { id: "demo-computing", title: "Computing", handle: "computing", mediaUrl: laptop.src },
  { id: "demo-mobile", title: "Mobile devices", handle: "mobile-devices", mediaUrl: phone.src },
  { id: "demo-peripherals", title: "Peripherals", handle: "peripherals", mediaUrl: peripheral.src },
];
export const nexahubDemoCategories: StoreCategory[] = nexahubDemoCollections.map((collection) => ({ id: `category-${collection.id}`, name: collection.title, handle: collection.handle, parentCategoryId: null, mediaUrl: collection.mediaUrl }));
const seeds = [
  ["portable-workstation", "Portable Workstation", 84_900, laptop.src, 0],
  ["everyday-smartphone", "Everyday Smartphone", 34_500, phone.src, 1],
  ["wireless-keyboard", "Wireless Keyboard", 4_800, peripheral.src, 2],
  ["usb-c-dock", "USB-C Connectivity Dock", 8_200, featured.src, 2],
  ["compact-laptop", "Compact Performance Laptop", 62_000, laptop.src, 0],
  ["wireless-mouse", "Precision Wireless Mouse", 2_950, peripheral.src, 2],
] as const;
export const nexahubDemoProducts: StoreProduct[] = seeds.map(([handle,title,priceAmount,thumbnail,collectionIndex],index)=>{const collection=nexahubDemoCollections[collectionIndex];const originalPriceAmount=index===3?9_400:null;return{id:`nexa-demo-product-${index+1}`,title,handle,description:"A practical technology product configured as bounded demonstration data. Production storefronts always use the merchant’s current catalog.",thumbnail,images:[thumbnail],variants:[{id:`nexa-demo-variant-${index+1}`,title:"Standard",sku:`NEX-${String(index+1).padStart(3,"0")}`,manageInventory:true,allowBackorder:false,inventoryQuantity:10,inStock:true,priceAmount,originalPriceAmount,discountAmount:originalPriceAmount?originalPriceAmount-priceAmount:null,discountPercentage:originalPriceAmount?13:null,currencyCode:"ETB",optionValues:[]}],options:[],collectionId:collection?.id??null,collectionTitle:collection?.title??null,categoryIds:collection?[`category-${collection.id}`]:[],priceAmount,originalPriceAmount,discountAmount:originalPriceAmount?originalPriceAmount-priceAmount:null,discountPercentage:originalPriceAmount?13:null,currencyCode:"ETB"};});
export const nexahubDemoCart:StoreCart={id:"nexa-demo-cart",regionId:"demo-ethiopia",email:"customer@example.com",currencyCode:"ETB",subtotal:119_400,itemTotal:119_400,itemSubtotal:119_400,itemDiscountTotal:0,shippingTotal:250,shippingSubtotal:250,shippingDiscountTotal:0,taxTotal:0,discountTotal:0,originalTotal:119_650,total:119_650,promotions:[],items:[nexahubDemoProducts[0],nexahubDemoProducts[1]].map((product,index)=>({id:`nexa-demo-line-${index+1}`,title:product?.title??"Product",quantity:1,unitPrice:product?.priceAmount??0,total:product?.priceAmount??0,thumbnail:product?.thumbnail??null,variantId:product?.variants[0]?.id??null,productHandle:product?.handle??null,variantTitle:product?.variants[0]?.title??null,subtotal:product?.priceAmount??0,discountTotal:0,originalTotal:product?.priceAmount??0}))};
export const nexahubDemoDelivery:StoreDeliveryOptions={deliveryEnabled:true,pickupEnabled:true,phoneConfirmationRequired:true,notesEnabled:true,landmarkRequired:false,defaultDeliveryFee:"250",currency:"ETB",zones:[]};
export const nexahubDemoShippingOptions:StoreShippingOption[]=[{id:"nexa-demo-delivery",name:"Addis Ababa delivery",amount:250,currencyCode:"ETB"},{id:"nexa-demo-pickup",name:"Store pickup",amount:0,currencyCode:"ETB"}];
export const nexahubDemoOrder:LastOrderCookie={currencyCode:"ETB",id:"order_demo_nexahub_2048",total:119_650};
export function findNexahubDemoProduct(handle:string){return nexahubDemoProducts.find((product)=>product.handle===handle)??null;}
