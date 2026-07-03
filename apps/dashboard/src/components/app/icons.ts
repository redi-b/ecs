import {
  RiBankCardLine,
  RiBarChartBoxLine,
  RiCommandLine,
  RiEyeCloseLine,
  RiEyeLine,
  RiHome5Line,
  RiLogoutBoxRLine,
  RiMoonLine,
  RiPaintBrushLine,
  RiSearchLine,
  RiSettings4Line,
  RiShoppingBag3Line,
  RiShoppingCart2Line,
  RiSunLine,
  RiUser3Line,
} from "@remixicon/react";

export const AppIcons = {
  billing: RiBankCardLine,
  command: RiCommandLine,
  editor: RiPaintBrushLine,
  eye: RiEyeLine,
  eyeOff: RiEyeCloseLine,
  home: RiHome5Line,
  insights: RiBarChartBoxLine,
  logout: RiLogoutBoxRLine,
  moon: RiMoonLine,
  orders: RiShoppingCart2Line,
  products: RiShoppingBag3Line,
  search: RiSearchLine,
  settings: RiSettings4Line,
  sun: RiSunLine,
  user: RiUser3Line,
};

export type AppIcon = (typeof AppIcons)[keyof typeof AppIcons];
