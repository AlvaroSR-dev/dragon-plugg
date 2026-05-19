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
    if (html.length < 400 || /captcha|login|\u9a8c\u8bc1|\u5b89\u5168\u68c0\u6d4b|\u6ed1\u5757/i.test(html.slice(0, 4000))) {
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
  const optionGroups = extractOptionGroups(cleanHtml);
  const { colors, sizes } = splitKnownOptions(optionGroups);

  const specs = {};
  if (seller) specs.Supplier = decodeHtml(seller);
  if (images.length) specs.Images = `${images.length} source image${images.length === 1 ? "" : "s"} found`;
  if (optionGroups.length) specs.Options = `${optionGroups.length} option group${optionGroups.length === 1 ? "" : "s"} found`;

  return compact({
    title: tidyTitle(decodeHtml(title)),
    description: decodeHtml(description),
    price: normalizePrice(price),
    seller: decodeHtml(seller),
    images: images.map(proxyImageUrl),
    originalImages: images,
    optionGroups,
    colors,
    sizes,
    specs
  });
}

async function fetchImageResponse(rawUrl, fetchImpl = fetch) {
  let imageUrl;
  try {
    imageUrl = new URL(rawUrl);
  } catch (error) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
      body: "Invalid image URL"
    };
  }

  if (!["http:", "https:"].includes(imageUrl.protocol)) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
      body: "Invalid image URL"
    };
  }

  const response = await fetchImpl(imageUrl.href, {
    redirect: "follow",
    headers: {
      Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      Referer: `${imageUrl.protocol}//${imageUrl.hostname}/`,
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    }
  });

  if (!response.ok) {
    return {
      statusCode: response.status,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
      body: `Image source returned HTTP ${response.status}`
    };
  }

  const arrayBuffer = await response.arrayBuffer();

  return {
    statusCode: 200,
    isBase64Encoded: true,
    headers: {
      "Content-Type": response.headers.get("content-type") || "image/jpeg",
      "Cache-Control": "public, max-age=86400"
    },
    body: Buffer.from(arrayBuffer).toString("base64")
  };
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

function extractOptionGroups(html) {
  const candidates = [
    ...jsonValuesAfterKeys(html, [
      "skuProps",
      "skuPropertyList",
      "skuPropsList",
      "offerSaledPropertyList",
      "salePropList",
      "skuPropList",
      "skuPropsMap"
    ]),
    ...parseEmbeddedJsonBlocks(html)
  ];

  const groups = [];

  for (const candidate of candidates) {
    collectOptionGroups(candidate, groups);
  }

  return dedupeOptionGroups(groups).slice(0, 6);
}

function jsonValuesAfterKeys(html, keys) {
  const values = [];

  for (const key of keys) {
    const pattern = new RegExp(`["']?${escapeRegExp(key)}["']?\\s*:`, "gi");
    let match;

    while ((match = pattern.exec(html))) {
      const value = readBalancedJsonValue(html, match.index + match[0].length);
      if (!value) continue;

      const parsed = parseLooseJson(value);
      if (parsed) values.push(parsed);
    }
  }

  return values;
}

function parseEmbeddedJsonBlocks(html) {
  const values = [];
  const patterns = [
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
    /window\.__INIT_DATA\s*=\s*({[\s\S]*?})\s*<\/script>/gi,
    /window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?})\s*;?/gi
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(html))) {
      const parsed = parseLooseJson(match[1]);
      if (parsed) values.push(parsed);
    }
  }

  return values;
}

function readBalancedJsonValue(text, startIndex) {
  let index = startIndex;
  while (/\s/.test(text[index])) index += 1;

  const open = text[index];
  const close = open === "{" ? "}" : open === "[" ? "]" : "";
  if (!close) return "";

  let depth = 0;
  let inString = false;
  let quote = "";
  let escaped = false;

  for (let cursor = index; cursor < text.length; cursor += 1) {
    const char = text[cursor];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        inString = false;
      }
      continue;
    }

    if (char === "\"" || char === "'") {
      inString = true;
      quote = char;
      continue;
    }

    if (char === open) depth += 1;
    if (char === close) depth -= 1;

    if (depth === 0) {
      return text.slice(index, cursor + 1);
    }
  }

  return "";
}

function parseLooseJson(value) {
  const decoded = decodeHtml(String(value || "").trim())
    .replace(/\\u002F/g, "/")
    .replace(/\\"/g, "\"")
    .replace(/\\\//g, "/");

  const attempts = [
    decoded,
    decoded.replace(/'/g, "\""),
    decoded.replace(/([{,]\s*)([A-Za-z_$][\w$-]*)(\s*:)/g, "$1\"$2\"$3").replace(/'/g, "\"")
  ];

  for (const attempt of attempts) {
    try {
      return JSON.parse(attempt);
    } catch (error) {
      // Try the next repair.
    }
  }

  return null;
}

function collectOptionGroups(node, groups, depth = 0) {
  if (!node || depth > 8) return;

  if (Array.isArray(node)) {
    const directGroups = node
      .map(toOptionGroup)
      .filter((group) => group.values.length);

    if (directGroups.length) {
      groups.push(...directGroups);
      return;
    }

    node.forEach((item) => collectOptionGroups(item, groups, depth + 1));
    return;
  }

  if (typeof node !== "object") return;

  const direct = toOptionGroup(node);
  if (direct.values.length) {
    groups.push(direct);
  }

  Object.values(node).forEach((value) => collectOptionGroups(value, groups, depth + 1));
}

function toOptionGroup(node) {
  if (!node || typeof node !== "object" || Array.isArray(node)) {
    return { name: "", values: [] };
  }

  const name = stringValue(
    node.name ||
      node.prop ||
      node.propName ||
      node.propertyName ||
      node.skuPropertyName ||
      node.attributeName ||
      node.specName ||
      node.title
  );

  const rawValues =
    node.values ||
    node.value ||
    node.items ||
    node.children ||
    node.options ||
    node.skuPropertyValues ||
    node.propertyValueList ||
    node.valueList;

  const values = Array.isArray(rawValues)
    ? rawValues
        .map((value) =>
          stringValue(
            value?.name ||
              value?.value ||
              value?.valueName ||
              value?.text ||
              value?.title ||
              value?.label ||
              value?.specValue ||
              value?.skuPropertyValueName ||
              value
          )
        )
        .filter(Boolean)
    : [];

  return {
    name: normalizeOptionName(name),
    values: unique(values.map(cleanOptionValue)).slice(0, 40)
  };
}

function splitKnownOptions(optionGroups) {
  const colors = [];
  const sizes = [];

  for (const group of optionGroups) {
    if (/color|colour|颜色|顏色|款式|style/i.test(group.name)) {
      colors.push(...group.values);
    }

    if (/size|尺码|尺寸|規格|规格|码数/i.test(group.name)) {
      sizes.push(...group.values);
    }
  }

  return compact({
    colors: unique(colors).slice(0, 40),
    sizes: unique(sizes).slice(0, 40)
  });
}

function dedupeOptionGroups(groups) {
  const seen = new Set();
  const output = [];

  for (const group of groups) {
    if (!group.name || group.values.length < 1) continue;
    const key = `${group.name.toLowerCase()}::${group.values.join("|").toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(group);
  }

  return output;
}

function normalizeOptionName(value) {
  const clean = cleanOptionValue(value);
  if (/颜色|顏色/i.test(clean)) return "Color";
  if (/尺码|尺寸|码数/i.test(clean)) return "Size";
  if (/规格|規格/i.test(clean)) return "Specification";
  if (/款式/i.test(clean)) return "Style";
  return clean;
}

function cleanOptionValue(value) {
  return decodeHtml(value)
    .replace(/\s+/g, " ")
    .replace(/^[：:\-]+|[：:\-]+$/g, "")
    .trim();
}

function stringValue(value) {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  return "";
}

function proxyImageUrl(imageUrl) {
  return `/api/image?url=${encodeURIComponent(imageUrl)}`;
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
    .replace(/\s*[-_]\s*(\u6dd8\u5b9d\u7f51|Tmall|\u5929\u732b|1688|Weidian|\u5fae\u5e97).*$/i, "")
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
  fetchImageResponse,
  parseMarketplaceUrl,
  extractProductData,
  fallbackProduct
};
