# Taobao & 1688 Product Scraper

A full-stack web application for scraping detailed product information from Taobao and 1688 e-commerce platforms.

## 🎯 Features

### Frontend
- 🔍 **Clean Search Interface**: Input any Taobao or 1688 product link
- 📸 **Image Gallery**: Main image display with clickable thumbnails
- 💰 **Product Details**: Price, stock status, seller information
- 📋 **Specifications**: Product options and variants
- 📱 **Responsive Design**: Works on desktop, tablet, and mobile devices
- ⚡ **Real-time Loading**: Visual feedback during scraping
- 📊 **Raw JSON Export**: View complete scraped data

### Backend
- 🚀 **Express.js Server**: RESTful API for product scraping
- 🕷️ **Puppeteer Integration**: Headless Chrome browser automation
- 🔗 **URL Validation**: Automatic platform detection
- 📦 **Cheerio HTML Parser**: Extract specific data from page HTML
- 🛡️ **Error Handling**: Graceful error management
- ⏱️ **Smart Timeouts**: Handle slow-loading pages

## 📋 Supported URLs

### Taobao
- `taobao.com`
- `item.taobao.com`
- `m.taobao.com` (mobile)

### 1688
- `1688.com`
- `detail.1688.com`
- `m.1688.com` (mobile)

## 🗂️ Project Structure

```
dragon-plugg/
├── server.js                          # Main Express server
├── package.json                       # Dependencies
├── routes/
│   └── scraper.js                    # API routes
├── services/
│   └── scraperService.js             # Puppeteer scraping logic
├── parsers/
│   └── productParser.js              # HTML parsing for each platform
├── utils/
│   └── urlParser.js                  # URL validation & product ID extraction
└── public/
    ├── index.html                    # Main HTML page
    ├── js/
    │   └── main.js                   # Frontend JavaScript
    └── styles/
        └── main.css                  # Styling & animations
```

## 🚀 Getting Started

### Prerequisites
- Node.js 14.0 or higher
- npm or yarn

### Installation

1. **Clone the repository** (or navigate to it if already cloned)
```bash
cd dragon-plugg
```

2. **Install dependencies**
```bash
npm install
```

3. **Start the development server**
```bash
npm run dev
```

4. **Open in browser**
```
http://localhost:3000
```

### Production Build
```bash
npm start
```

## 🔌 API Endpoints

### POST `/api/scraper/product`

**Request:**
```json
{
  "url": "https://item.taobao.com/item.htm?id=123456789"
}
```

**Response:**
```json
{
  "success": true,
  "platform": "taobao",
  "productId": "123456789",
  "data": {
    "name": "Product Name",
    "price": "¥99.99",
    "images": ["url1", "url2", ...],
    "stock": "In Stock",
    "seller": {
      "name": "Seller Name",
      "rate": "4.9/5"
    },
    "shipping": {
      "local": "Free Shipping",
      "info": "Delivery info"
    },
    "options": [
      {
        "name": "Color",
        "values": ["Red", "Blue", "Green"]
      }
    ],
    "description": "Product description...",
    "scraped_at": "2024-01-15T10:30:00Z"
  }
}
```

**Error Response:**
```json
{
  "error": "Invalid URL",
  "message": "Please provide a valid Taobao or 1688 product link"
}
```

## 🛠️ Technologies Used

| Layer | Technology |
|-------|-----------|
| **Frontend** | HTML5, CSS3, Vanilla JavaScript |
| **Backend** | Node.js, Express.js |
| **Scraping** | Puppeteer, Cheerio |
| **Styling** | CSS3 Grid, Flexbox, Animations |

## 📦 Dependencies

```json
{
  "express": "^4.18.2",
  "puppeteer": "^21.0.0",
  "cheerio": "^1.0.0-rc.12",
  "cors": "^2.8.5",
  "dotenv": "^16.3.1",
  "axios": "^1.5.0"
}
```

## 🔐 Important Notes

### Rate Limiting
- Respect the platforms' Terms of Service
- Implement delays between requests if scraping multiple products
- Use appropriate User-Agent headers

### Legal Compliance
- Review Taobao and 1688 Terms of Service before using
- Don't scrape for commercial purposes without permission
- Respect copyright and intellectual property rights

### Performance
- Puppeteer runs a full browser instance - requires sufficient RAM
- Consider caching results to reduce redundant scrapes
- Set appropriate timeouts for slow connections

## 🐛 Troubleshooting

### Issue: "Failed to scrape product"
- Ensure URL is correct and accessible
- Check internet connection
- Verify the product page hasn't been removed

### Issue: Images not loading
- Some images may have CORS restrictions
- Platform may block direct image access
- Try refreshing the page

### Issue: Slow performance
- Large images take time to download
- Platform may be throttling requests
- Consider implementing request queuing

## 🚀 Future Enhancements

- [ ] Multiple product scraping in batch
- [ ] Export to CSV/Excel
- [ ] Price tracking over time
- [ ] Comparison tool for multiple products
- [ ] Shopping cart integration
- [ ] Database storage for scraped products
- [ ] Advanced filtering and search
- [ ] Product recommendation engine
- [ ] Multi-language support
- [ ] API rate limiting & authentication

## 📄 License

MIT License - See LICENSE file for details

## 👨‍💻 Author

**AlvaroSR-dev**

## 📞 Support

For issues, questions, or suggestions, please open an issue on GitHub.

## ⚠️ Disclaimer

This tool is provided for educational purposes only. Users are responsible for complying with all applicable laws and the Terms of Service of Taobao and 1688. The authors assume no responsibility for misuse of this tool.

---

**Happy scraping! 🎉**
