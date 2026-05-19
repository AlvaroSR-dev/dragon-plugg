const { getProductPayload } = require("../../src/product-service");

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return jsonResponse(405, {
      ok: false,
      error: "Method not allowed"
    });
  }

  const sourceUrl = event.queryStringParameters?.url || "";
  const result = await getProductPayload(sourceUrl);

  return jsonResponse(result.statusCode, result.body);
};

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify(body)
  };
}
