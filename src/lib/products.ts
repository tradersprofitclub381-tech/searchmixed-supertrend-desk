export type Product = {
  name: string;
  tag: string;
  blurb: string;
  href: string;
};

export const PRODUCTS: Product[] = [
  {
    name: "Liquidity Magnet Pro",
    tag: "Order flow",
    blurb: "Historical liquidity pools plus live bid/ask volume, so stop clusters and reactions are visible.",
    href: "https://www.mql5.com/en/market/product/205887",
  },
  {
    name: "OrderFlow Candle Classifier",
    tag: "Auction",
    blurb: "Splits volume into buyer and seller flow, classifies the candle, and marks fair value gaps.",
    href: "https://www.mql5.com/en/market/product/206375",
  },
  {
    name: "Deriv Synthetic Smasher",
    tag: "Synthetics",
    blurb: "Finds consolidation on synthetic indices and waits for the range to break with a filter.",
    href: "https://www.mql5.com/en/market/product/183880",
  },
  {
    name: "Volume Flow Profile",
    tag: "Volume",
    blurb: "Daily volume profile and money flow, with a theme that follows the chart.",
    href: "https://www.mql5.com/en/market/product/169636",
  },
  {
    name: "Swing Supply Demand",
    tag: "Structure",
    blurb: "Draws supply and demand from swing pivots, then extends or mitigates the zone.",
    href: "https://www.mql5.com/en/market/product/158281",
  },
  {
    name: "Deriv BC Blue Guardian",
    tag: "Boom & Crash",
    blurb: "Multi-oscillator confluence for Boom and Crash spike zones, built for synthetic desks.",
    href: "https://www.mql5.com/en/market/product/193563",
  },
  {
    name: "Master Volume Profile",
    tag: "MT4",
    blurb: "Money-flow profile for MetaTrader 4, aimed at session structure rather than raw ticks.",
    href: "https://www.mql5.com/en/market/product/169637",
  },
  {
    name: "Liquidity Heatmap Basic",
    tag: "Liquidity",
    blurb: "Estimates liquidation pockets from volume spikes so crowded leverage is easier to see.",
    href: "https://www.mql5.com/en/market/product/156115",
  },
  {
    name: "Liquidity HeatMap Profile",
    tag: "Liquidity",
    blurb: "Drops a liquidity level once price trades through it, so the chart stays current.",
    href: "https://www.mql5.com/en/market/product/156036",
  },
  {
    name: "Quant Range Pro",
    tag: "Ranges",
    blurb: "Scans for balance areas and the break that leaves them, with a trade journal beside the chart.",
    href: "https://www.mql5.com/en/market/product/191251",
  },
  {
    name: "Gold Max Pro",
    tag: "Free",
    blurb: "A clean gold workspace with a one-click timeframe panel and a fixed professional theme.",
    href: "https://www.mql5.com/en/market/product/165234",
  },
  {
    name: "Crash Spike Mitigation Zone",
    tag: "Free",
    blurb: "Boxes the three-candle spike pattern on Crash and marks where the zone is mitigated.",
    href: "https://www.mql5.com/en/market/product/143493",
  },
];
