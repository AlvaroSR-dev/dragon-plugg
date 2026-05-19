const { fetchImageResponse } = require("../../src/product-service");

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
      body: "Method not allowed"
    };
  }

  const sourceUrl = event.queryStringParameters?.url || "";

  try {
    return await fetchImageResponse(sourceUrl);
  } catch (error) {
    return {
      statusCode: 502,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
      body: error.message
    };
  }
};
