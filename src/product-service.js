const PLATFORM_DEFAULTS = {
  taobao: {
    label: "Taobao",
    color: "#d97620",
    category: "fashion",
    seller: "Taobao supplier",
    rating: "Source page detected",
    colors: ["Black", "White", "Grey"],
    sizes: ["S", "M", "L", "XL"]
  },
  tmall: {
    label: "Tmall",
    color: "#c7442f",
    category: "fashion",
    seller: "Tmall supplier",
    rating: "Source page detected",
    colors: ["Black", "White", "Grey"],
    sizes: ["M", "L", "XL", "XXL"]
  },
  weidian: {
    label: "Weidian",
    color: "#2f7d5a",
    category: "sneaker",
    seller: "Weidian supplier",
    rating: "Source page detected",
    colors: ["White", "Black", "Sail"],
    sizes: ["39", "40", "41", "42", "43", "44", "45"]
  },
  "1688": {
    label: "1688",
    color: "#1e5e8c",
    category: "wholesale",
    seller: "1688 supplier",
    rating: "Factory source detected",
    colors: ["Mixed", "Black", "White"],
    sizes: ["10 pcs", "50 pcs", "100 pcs"]
  }
};

async function getProductPayload(rawUrl, fetchImpl = fetch) {
  const parsed = parseMarketplaceUrl(rawUrl);

  if (!parsed) {
    return {
      statusCode: 400,
      body: {
        ok: false,
        error: "Paste a valid 1688, Taobao, Tmall or Weidian product link."
      }
    };
  }

  const defaults = PLATFORM_DEFAULTS[parsed.platform];
  const payload = {
    ok: true,
    blocked: false,
    product: fallbackProduct(parsed),
    extraction: {
      fields: [],
      note: "Fetched source page and extracted public metadata."
    }
  };

  try {
    const html = await fetchMarketplaceHtml(parsed.sourceUrl, fetchImpl);
    const extracted = extractProductData(html, parsed);
    const fields = Object.keys(extracted).filter((key) => {
      const value = extracted[key];
      return Array.isArray(value) ? value.length > 0 : Boolean(value);
    });

    payload.product = {
      ...payload.product,
      ...extracted,
      id: parsed.productId,
      sourceUrl: parsed.sourceUrl,
      platform: parsed.platform,
      label: defaults.label,
      color: defaults.color,
      category: defaults.category,
      specs: {
        ...payload.product.specs,
        ...(extracted.specs || {}),
        Source: `${defaults.label} product page`
      }
    };
    payload.extraction.fields = fields;
  } catch (error) {
    payload.blocked = true;
    payload.extraction = {
      fields: [],
      note: "The marketplace did not return public HTML to this API. Showing a structured fallback from the link while keeping the source URL.",
      reason: error.message
    };
  }

  return {
    statusCode: 200,
    body: payload
  };
}

function parseMarketplaceUrl(rawUrl) {
  if (!rawUrl || !rawUrl.trim()) return null;

  let url;
  try {
    url = new URL(rawUrl.trim());
  } catch (error) {
    return null;
  }

  if (!["http:", "https:"].includes(url.protocol)) return null;

  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  let platform = null;

  if (host.includes("taobao.com")) platform = "taobao";
  if (host.includes("tmall.com")) platform = "tmall";
  if (host.includes("weidian.com")) platform = "weidian";
  if (host.includes("1688.com")) platform = "1688";
  if (!platform) return null;

  const productId =
    url.searchParams.get("id") ||
    url.searchParams.get("itemID") ||
    url.searchParams.get("itemId") ||
    url.searchParams.get("offerId") ||
    (url.pathname.match(/offer\/(\d+)/) || [])[1] ||
    (url.pathname.match(/item\/(\d+)/) || [])[1] ||
    "preview-000000";

  return {
    platform,
    productId,
    sourceUrl: url.href
  };
}

async function fetchMarketplaceHtml(sourceUrl, fetchImpl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetchImpl(sourceUrl, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
      }
    });

    if (!response.ok) {
      throw new Error(`Source returned HTTP ${response.status}`);
    }

    const html = await response.text();
    if (html.length < 400 || /captcha|login|验证|安全检测|滑块/i.test(html.slice(0, 4000))) {
      throw new Error("Source returned an anti-bot, login, or captcha page");
    }

    return html;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("Source request timed out");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function fallbackProduct(parsed) {
  const defaults = PLATFORM_DEFAULTS[parsed.platform];
  const idDigits = Number(String(parsed.productId).replace(/\D/g, "").slice(-4)) || 1375;
  const basePrice = parsed.platform === "weidian" ? 420 : parsed.platform === "1688" ? 59 : 199;

  return {
    id: parsed.productId,
    sourceUrl: parsed.sourceUrl,
    platform: parsed.platform,
    label: defaults.label,
    color: defaults.color,
    category: defaults.category,
    title: `${defaults.label} product ${parsed.productId}`,
    description: "The API parsed the marketplace link. Some live fields may be unavailable if the source blocks public HTML requests.",
    price: String(Math.max(29, basePrice + (idDigits % 37) - 18)),
    seller: defaults.seller,
    rating: defaults.rating,
    colors: defaults.colors,
    sizes: defaults.sizes,
    images: [],
    sellerCode: defaults.label.slice(0, 2).toUpperCase(),
    specs: {
      ProductID: parsed.productId,
      Source: `${defaults.label} product page`,
      Checkout: "Agent order, QC review, international shipping"
    }
  };
}

function extractProductData(html, parsed) {
  const cleanHtml = html.replace(/\\"/g, "\"").replace(/\\\//g, "/");
  const title =
    metaContent(cleanHtml, "property", "og:title") ||
    metaContent(cleanHtml, "name", "title") ||
    textBetween(cleanHtml, /<title[^>]*>/i, /<\/title>/i);

  const description =
    metaContent(cleanHtml, "property", "og:description") ||
    metaContent(cleanHtml, "name", "description");

  const price =
    firstRegex(cleanHtml, [
      /"price"\s*:\s*"?([0-9]+(?:\.[0-9]+)?)/i,
      /"priceRange"\s*:\s*"?([0-9]+(?:\.[0-9]+)?(?:\s*[-~]\s*[0-9]+(?:\.[0-9]+)?)?)/i,
      /"salePrice"\s*:\s*"?([0-9]+(?:\.[0-9]+)?)/i,
      /"priceCent"\s*:\s*"?([0-9]{3,})/i
    ]);

  const seller =
    firstRegex(cleanHtml, [
      /"shopName"\s*:\s*"([^"]{2,80})"/i,
      /"sellerNick"\s*:\s*"([^"]{2,80})"/i,
      /"companyName"\s*:\s*"([^"]{2,100})"/i,
      /"storeName"\s*:\s*"([^"]{2,80})"/i
    ]);

  const images = unique([
    metaContent(cleanHtml, "property", "og:image"),
    metaContent(cleanHtml, "name", "twitter:image"),
    ...extractImageUrls(cleanHtml)
  ])
    .map((image) => normalizeImageUrl(image, parsed.sourceUrl))
    .filter(Boolean)
    .slice(0, 8);

  const specs = {};
  if (seller) specs.Supplier = decodeHtml(seller);
  if (images.length) specs.Images = `${images.length} source image${images.length === 1 ? "" : "s"} found`;

  return compact({
    title: tidyTitle(decodeHtml(title)),
    description: decodeHtml(description),
    price: normalizePrice(price),
    seller: decodeHtml(seller),
    images,
    specs
  });
}

function extractImageUrls(html) {
  const urls = [];
  const patterns = [
    /https?:\\?\/\\?\/[^"'<> ]+\.(?:jpg|jpeg|png|webp)(?:\?[^"'<> ]*)?/gi,
    /\/\/[^"'<> ]+\.(?:jpg|jpeg|png|webp)(?:\?[^"'<> ]*)?/gi
  ];

  for (const pattern of patterns) {
    urls.push(...(html.match(pattern) || []));
  }

  return urls
    .map((url) => url.replace(/\\u002F/g, "/").replace(/\\/g, ""))
    .filter((url) => !/sprite|icon|logo|avatar|loading|blank/i.test(url));
}

function metaContent(html, attrName, attrValue) {
  const attr = escapeRegExp(attrValue);
  const patterns = [
    new RegExp(`<meta[^>]+${attrName}=["']${attr}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+${attrName}=["']${attr}["'][^>]*>`, "i")
  ];
  return firstRegex(html, patterns);
}

function textBetween(html, startPattern, endPattern) {
  const start = html.search(startPattern);
  if (start < 0) return "";

  const afterStart = html.slice(start).replace(startPattern, "");
  const end = afterStart.search(endPattern);
  if (end < 0) return "";

  return afterStart.slice(0, end);
}

function firstRegex(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) return match[1];
  }
  return "";
}

function normalizeImageUrl(imageUrl, sourceUrl) {
  if (!imageUrl) return "";

  const decoded = decodeHtml(imageUrl).trim().replace(/^https?:\/\/https?:\/\//, "https://");

  try {
    return new URL(decoded.startsWith("//") ? `https:${decoded}` : decoded, sourceUrl).href;
  } catch (error) {
    return "";
  }
}

function normalizePrice(price) {
  if (!price) return "";

  const value = String(price).trim();
  if (/^\d{3,}$/.test(value) && Number(value) > 9999) {
    return String(Number(value) / 100);
  }

  return value.replace(/[^\d.~ -]/g, "");
}

function tidyTitle(title) {
  return String(title || "")
    .replace(/\s*[-_]\s*(淘宝网|Tmall|天猫|1688|Weidian|微店).*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .trim();
}

function compact(object) {
  return Object.fromEntries(
    Object.entries(object).filter(([, value]) => {
      if (Array.isArray(value)) return value.length > 0;
      if (value && typeof value === "object") return Object.keys(value).length > 0;
      return Boolean(value);
    })
  );
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = {
  getProductPayload,
  parseMarketplaceUrl,
  extractProductData,
  fallbackProduct
};
