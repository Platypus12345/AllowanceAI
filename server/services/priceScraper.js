const axios = require('axios');
const cheerio = require('cheerio');

function detectPlatform(url) {
  if (url.includes('amazon.in') || url.includes('amazon.com')) return 'Amazon';
  if (url.includes('flipkart.com')) return 'Flipkart';
  if (url.includes('myntra.com')) return 'Myntra';
  if (url.includes('meesho.com')) return 'Meesho';
  if (url.includes('nykaa.com')) return 'Nykaa';
  if (url.includes('ajio.com')) return 'Ajio';
  return 'Other';
}

function extractNumber(text) {
  if (!text) return null;
  const cleaned = String(text).replace(/[₹,\s]/g, '');
  const num = parseFloat(cleaned);
  return Number.isNaN(num) ? null : num;
}

async function scrapePrice(url) {
  try {
    const platform = detectPlatform(url);
    const { data } = await axios.get(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
      timeout: 12000,
      maxRedirects: 5,
    });

    const $ = cheerio.load(data);
    let price = null;
    let name = null;
    let imageUrl = null;
    let inStock = true;

    if (platform === 'Amazon') {
      price = extractNumber(
        $('#priceblock_ourprice').text() ||
          $('#priceblock_dealprice').text() ||
          $('.a-price .a-offscreen').first().text() ||
          $('.a-price-whole').first().text()
      );
      name = $('#productTitle').text().trim();
      imageUrl = $('#landingImage').attr('src') || $('#imgBlkFront').attr('src');
      inStock = !$('#availability').text().toLowerCase().includes('unavailable');
    } else if (platform === 'Flipkart') {
      price = extractNumber($('._30jeq3').first().text());
      name = $('.B_NuCI').text().trim() || $('span.B_NuCI').first().text().trim();
      imageUrl = $('img._396cs4').first().attr('src');
    } else if (platform === 'Myntra') {
      price = extractNumber($('.pdp-price strong').text() || $('[class*="pdp-price"]').first().text());
      name = $('.pdp-name').text().trim();
      imageUrl = $('.image-grid-image').first().attr('src');
    } else if (platform === 'Meesho') {
      price = extractNumber($('[class*="Price"]').first().text());
      name = $('h1').first().text().trim();
    } else if (platform === 'Nykaa') {
      price = extractNumber($('[class*="price"]').first().text());
      name = $('h1').first().text().trim();
    } else if (platform === 'Ajio') {
      price = extractNumber($('[class*="prod-sp"]').first().text());
      name = $('[class*="prod-name"]').first().text().trim();
    } else {
      const bodyText = $('body').text();
      const matches = bodyText.match(/₹[\d,]+/);
      if (matches) price = extractNumber(matches[0]);
      name = $('title').text().trim();
    }

    if (price === null && platform !== 'Other') {
      inStock = false;
    }

    return { price, name, imageUrl, platform, inStock };
  } catch (error) {
    console.error('Scraping failed:', url, error.message);
    return { price: null, name: null, imageUrl: null, platform: detectPlatform(url), inStock: null };
  }
}

module.exports = { scrapePrice, detectPlatform, extractNumber };
