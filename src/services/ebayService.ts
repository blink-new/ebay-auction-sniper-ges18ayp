import { blink } from '../blink/client'

export interface EbayAuctionData {
  title: string
  currentBid: number
  endTime: Date
  itemId: string
  imageUrl?: string
  seller?: string
  bidCount?: number
  buyItNowPrice?: number
  condition?: string
  location?: string
  shipping?: string
}

export class EbayService {
  /**
   * Extract auction data from eBay URL using multiple reliable methods
   */
  static async extractAuctionData(url: string): Promise<EbayAuctionData> {
    // Validate eBay URL format
    if (!this.isValidEbayUrl(url)) {
      throw new Error('Please enter a valid eBay auction URL')
    }

    // Preprocess URL to ensure it's in the correct format
    const processedUrl = this.preprocessEbayUrl(url)
    const itemId = this.extractItemId(processedUrl)
    
    console.log('Attempting to get REAL eBay auction data for:', processedUrl)
    console.log('Extracted item ID:', itemId)

    // Method 1: Try eBay's public API endpoints
    try {
      console.log('Attempting eBay API approach...')
      const apiData = await this.fetchFromEbayAPI(itemId)
      if (apiData) {
        console.log('eBay API successful! Got real auction data.')
        return apiData
      }
    } catch (error) {
      console.warn('eBay API failed:', error)
    }

    // Method 2: Try direct page scraping with enhanced parsing
    try {
      console.log('Attempting enhanced web scraping...')
      const pageData = await this.performScrapingWithTimeout(processedUrl, 15000)
      console.log('Web scraping successful, parsing real auction data...')
      const auctionData = this.parseEbayPageData(pageData, itemId)
      
      // Validate that we got real data (not demo/fallback)
      if (auctionData.currentBid > 0 && !auctionData.title.includes('Demo Mode')) {
        console.log('Successfully extracted REAL auction data:', auctionData)
        return auctionData
      }
    } catch (error) {
      console.warn('Enhanced scraping failed:', error)
      
      // Check if it's a server error (500) and provide specific handling
      if (error instanceof Error) {
        if (error.message.includes('500') || error.message.includes('server responded with a status of 500')) {
          console.log('Server error detected, skipping to alternative methods...')
        } else if (error.message.includes('Unable to extract current bid')) {
          console.log('Price extraction failed, trying alternative methods...')
        } else if (error.message.includes('timeout')) {
          console.log('Scraping timeout, trying faster alternative methods...')
        }
      }
    }

    // Method 3: Try alternative scraping approaches
    const alternativeUrls = [
      this.convertToMobileUrl(processedUrl),
      this.simplifyEbayUrl(processedUrl, itemId),
      `https://www.ebay.com/itm/${itemId}`,
      `https://m.ebay.com/itm/${itemId}`
    ]

    for (const altUrl of alternativeUrls) {
      try {
        console.log(`Trying alternative URL: ${altUrl}`)
        const pageData = await this.performScrapingWithTimeout(altUrl, 15000)
        const auctionData = this.parseEbayPageData(pageData, itemId)
        
        if (auctionData.currentBid > 0 && !auctionData.title.includes('Demo Mode')) {
          console.log('Alternative URL successful! Got real data.')
          return auctionData
        }
      } catch (error) {
        console.warn(`Alternative URL ${altUrl} failed:`, error)
      }
    }

    // Method 4: Try using proxy/CORS bypass
    try {
      console.log('Attempting CORS bypass method...')
      const proxyData = await this.fetchWithProxy(processedUrl)
      if (proxyData) {
        console.log('Proxy method successful!')
        return proxyData
      }
    } catch (error) {
      console.warn('Proxy method failed:', error)
    }

    // If all real data methods fail, provide a helpful error message
    console.error('All real data extraction methods failed.')
    
    // Provide a more helpful error message instead of demo data
    throw new Error(
      'Unable to fetch real auction data from eBay. This could be due to:\n\n' +
      '• eBay blocking automated requests (most common)\n' +
      '• The auction URL is invalid or the item has been removed\n' +
      '• Network connectivity issues\n' +
      '• Server maintenance or temporary outages\n\n' +
      'Please try:\n' +
      '1. Verify the eBay auction URL is correct and active\n' +
      '2. Wait a few minutes and try again\n' +
      '3. Use a different eBay auction URL for testing\n\n' +
      'Note: This tool requires access to live eBay data to function properly.'
    )
  }

  /**
   * Validate if URL is a valid eBay auction URL
   */
  private static isValidEbayUrl(url: string): boolean {
    const ebayDomains = [
      'ebay.com',
      'ebay.co.uk',
      'ebay.de',
      'ebay.fr',
      'ebay.it',
      'ebay.es',
      'ebay.ca',
      'ebay.com.au'
    ]
    
    return ebayDomains.some(domain => url.includes(domain)) && 
           (url.includes('/itm/') || url.includes('/p/'))
  }

  /**
   * Preprocess eBay URL to ensure it's in the correct format
   */
  private static preprocessEbayUrl(url: string): string {
    // Remove any tracking parameters and clean up the URL
    let cleanUrl = url.split('?')[0] // Remove query parameters
    
    // Ensure HTTPS
    if (cleanUrl.startsWith('http://')) {
      cleanUrl = cleanUrl.replace('http://', 'https://')
    }
    
    // Ensure www prefix for main eBay domains
    if (cleanUrl.includes('ebay.com') && !cleanUrl.includes('www.')) {
      cleanUrl = cleanUrl.replace('ebay.com', 'www.ebay.com')
    }
    
    return cleanUrl
  }

  /**
   * Convert regular eBay URL to mobile format
   */
  private static convertToMobileUrl(url: string): string {
    return url.replace('www.ebay.com', 'm.ebay.com')
  }

  /**
   * Create simplified eBay URL using just the item ID
   */
  private static simplifyEbayUrl(url: string, itemId: string): string {
    // Extract domain from original URL
    const domain = url.includes('ebay.co.uk') ? 'www.ebay.co.uk' : 
                   url.includes('ebay.de') ? 'www.ebay.de' :
                   url.includes('ebay.fr') ? 'www.ebay.fr' :
                   url.includes('ebay.it') ? 'www.ebay.it' :
                   url.includes('ebay.es') ? 'www.ebay.es' :
                   url.includes('ebay.ca') ? 'www.ebay.ca' :
                   url.includes('ebay.com.au') ? 'www.ebay.com.au' :
                   'www.ebay.com'
    
    return `https://${domain}/itm/${itemId}`
  }

  /**
   * Extract item ID from eBay URL
   */
  private static extractItemId(url: string): string {
    // Try different patterns for item ID extraction
    const patterns = [
      /\/itm\/([^/?]+)/,
      /\/p\/(\d+)/,
      /item=(\d+)/,
      /\/(\d{12,})/
    ]
    
    for (const pattern of patterns) {
      const match = url.match(pattern)
      if (match) {
        return match[1]
      }
    }
    
    return 'unknown'
  }

  /**
   * Parse scraped eBay page data to extract auction information
   */
  private static parseEbayPageData(pageData: any, itemId: string): EbayAuctionData {
    const { markdown, metadata, extract } = pageData
    
    // Extract title from metadata or page content
    const title = this.extractTitle(metadata, extract, markdown)
    
    // Extract current bid/price
    const currentBid = this.extractCurrentBid(markdown, extract)
    
    // Extract end time
    const endTime = this.extractEndTime(markdown, extract)
    
    // Extract additional details
    const imageUrl = this.extractImageUrl(extract, markdown)
    const seller = this.extractSeller(markdown, extract)
    const bidCount = this.extractBidCount(markdown, extract)
    const condition = this.extractCondition(markdown, extract)
    const location = this.extractLocation(markdown, extract)
    const shipping = this.extractShipping(markdown, extract)
    
    return {
      title,
      currentBid,
      endTime,
      itemId,
      imageUrl,
      seller,
      bidCount,
      condition,
      location,
      shipping
    }
  }

  private static extractTitle(metadata: any, extract: any, markdown: string): string {
    // Try metadata title first
    if (metadata?.title) {
      return metadata.title.replace(' | eBay', '').trim()
    }
    
    // Try to find title in headings
    if (extract?.headings?.length > 0) {
      const mainHeading = extract.headings.find((h: any) => 
        h.level === 1 || h.text.length > 20
      )
      if (mainHeading) {
        return mainHeading.text.replace(' | eBay', '').trim()
      }
    }
    
    // Fallback to searching in markdown
    const titleMatch = markdown.match(/^#\s*(.+?)$/m)
    if (titleMatch) {
      return titleMatch[1].replace(' | eBay', '').trim()
    }
    
    return 'eBay Auction Item'
  }

  private static extractCurrentBid(markdown: string, extract: any): number {
    console.log('Attempting to extract current bid from auction data...')
    
    // Look for structured data in JSON-LD first (most reliable)
    if (extract?.jsonLd) {
      for (const item of extract.jsonLd) {
        if (item['@type'] === 'Product' && item.offers?.price) {
          const price = parseFloat(item.offers.price)
          if (!isNaN(price) && price > 0) {
            console.log(`Found price from JSON-LD: ${price}`)
            return price
          }
        }
      }
    }
    
    // Enhanced price extraction patterns (fixed regex)
    const mainPricePatterns = [
      // eBay specific patterns
      /US \$([0-9,]+\.?[0-9]*)\s*(?:[0-9]+\s*bids?)/i,
      /Current bid[:\s]*US\s*\$([0-9,]+\.?[0-9]*)/i,
      /Current bid[:\s]*\$([0-9,]+\.?[0-9]*)/i,
      /\$([0-9,]+\.?[0-9]*)\s*(?:[0-9]+\s*bids?)/i,
      
      // More flexible patterns
      /Price[:\s]*\$([0-9,]+\.?[0-9]*)/i,
      /Starting bid[:\s]*\$([0-9,]+\.?[0-9]*)/i,
      /Bid[:\s]*\$([0-9,]+\.?[0-9]*)/i,
      /\$([0-9,]+\.?[0-9]*)\s*current/i,
      
      // Buy it now patterns as fallback
      /Buy It Now[:\s]*\$([0-9,]+\.?[0-9]*)/i,
      /BIN[:\s]*\$([0-9,]+\.?[0-9]*)/i,
      
      // General price patterns
      /\$([0-9,]+\.?[0-9]*)/g
    ]
    
    // Try main price patterns
    for (const pattern of mainPricePatterns) {
      const match = markdown.match(pattern)
      if (match) {
        const priceStr = match[1].replace(/,/g, '')
        const price = parseFloat(priceStr)
        if (!isNaN(price) && price > 0 && price < 1000000) {
          console.log(`Found main auction price: ${price} using pattern: ${pattern}`)
          return price
        }
      }
    }
    
    // Enhanced fallback: Look for prices but exclude "similar items" sections
    const lines = markdown.split('\n')
    let inSimilarSection = false
    const foundPrices: number[] = []
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase()
      
      // Skip similar items sections
      if (line.includes('similar') || line.includes('related') || 
          line.includes('people who viewed') || line.includes('previous price') ||
          line.includes('sponsored') || line.includes('advertisement')) {
        inSimilarSection = true
        continue
      }
      
      // Reset when we hit the main item section
      if (line.includes('item description') || line.includes('condition:') || 
          line.includes('seller information') || line.includes('shipping:')) {
        inSimilarSection = false
      }
      
      if (!inSimilarSection) {
        // Try multiple price patterns on each line
        const pricePatterns = [
          /US \$([0-9,]+\.?[0-9]*)/i,
          /\$([0-9,]+\.?[0-9]*)/i
        ]
        
        for (const pattern of pricePatterns) {
          const priceMatch = lines[i].match(pattern)
          if (priceMatch) {
            const priceStr = priceMatch[1].replace(/,/g, '')
            const price = parseFloat(priceStr)
            if (!isNaN(price) && price > 0 && price < 1000000) {
              foundPrices.push(price)
              console.log(`Found potential price: ${price} from line: ${lines[i]}`)
            }
          }
        }
      }
    }
    
    // If we found prices, return the most reasonable one
    if (foundPrices.length > 0) {
      // Sort prices and take the median to avoid outliers
      foundPrices.sort((a, b) => a - b)
      const medianPrice = foundPrices[Math.floor(foundPrices.length / 2)]
      console.log(`Using median price from ${foundPrices.length} found prices: ${medianPrice}`)
      return medianPrice
    }
    
    // Last resort: try to extract any number that looks like a price
    const allNumbers = markdown.match(/\$?([0-9,]+\.?[0-9]*)/g)
    if (allNumbers) {
      const validPrices = allNumbers
        .map(num => parseFloat(num.replace(/[$,]/g, '')))
        .filter(price => !isNaN(price) && price > 0 && price < 1000000 && price >= 0.01)
      
      if (validPrices.length > 0) {
        // Take the most common price range (likely the actual bid)
        validPrices.sort((a, b) => a - b)
        const reasonablePrice = validPrices.find(price => price >= 1 && price <= 10000) || validPrices[0]
        console.log(`Using last resort price extraction: ${reasonablePrice}`)
        return reasonablePrice
      }
    }
    
    // If absolutely no price found, provide a more helpful error
    console.error('No valid price found in auction data')
    console.log('Available data for debugging:', {
      markdownLength: markdown.length,
      hasExtract: !!extract,
      extractKeys: extract ? Object.keys(extract) : [],
      markdownPreview: markdown.substring(0, 500)
    })
    
    throw new Error('Unable to extract current bid/price from auction. This could be because:\n' +
      '• The auction has ended or been removed\n' +
      '• The page structure has changed\n' +
      '• eBay is blocking automated access\n' +
      '• The URL is not a valid auction page\n\n' +
      'Please verify the auction URL is correct and try again.')
  }

  private static extractEndTime(markdown: string, extract: any): Date {
    // Look for time remaining patterns
    const timePatterns = [
      /(\d+)d\s*(\d+)h\s*(\d+)m/i, // "5d 12h 30m"
      /(\d+)\s*days?\s*(\d+)\s*hours?\s*(\d+)\s*minutes?/i,
      /(\d+)\s*hours?\s*(\d+)\s*minutes?/i,
      /(\d+)\s*minutes?/i,
      /ends?\s*in[:\s]*(.+?)(?:\n|$)/i
    ]
    
    for (const pattern of timePatterns) {
      const match = markdown.match(pattern)
      if (match) {
        const now = new Date()
        
        if (match[3]) {
          // Days, hours, minutes
          const days = parseInt(match[1]) || 0
          const hours = parseInt(match[2]) || 0
          const minutes = parseInt(match[3]) || 0
          return new Date(now.getTime() + (days * 24 * 60 + hours * 60 + minutes) * 60 * 1000)
        } else if (match[2]) {
          // Hours, minutes
          const hours = parseInt(match[1]) || 0
          const minutes = parseInt(match[2]) || 0
          return new Date(now.getTime() + (hours * 60 + minutes) * 60 * 1000)
        } else if (match[1]) {
          // Just minutes
          const minutes = parseInt(match[1]) || 0
          return new Date(now.getTime() + minutes * 60 * 1000)
        }
      }
    }
    
    // Default to 2 hours from now if no time found
    return new Date(Date.now() + 2 * 60 * 60 * 1000)
  }

  private static extractImageUrl(extract: any, markdown: string): string | undefined {
    // Look for image URLs in the extracted data
    if (extract?.images?.length > 0) {
      return extract.images[0]
    }
    
    // Look for image URLs in markdown
    const imageMatch = markdown.match(/!\[.*?\]\((https?:\/\/[^)]+)\)/)
    if (imageMatch) {
      return imageMatch[1]
    }
    
    return undefined
  }

  private static extractSeller(markdown: string, extract: any): string | undefined {
    const sellerPatterns = [
      /seller[:\s]*([^\n\r]+)/i,
      /sold by[:\s]*([^\n\r]+)/i,
      /from[:\s]*([^\n\r]+)/i
    ]
    
    for (const pattern of sellerPatterns) {
      const match = markdown.match(pattern)
      if (match) {
        return match[1].trim()
      }
    }
    
    return undefined
  }

  private static extractBidCount(markdown: string, extract: any): number | undefined {
    const bidPatterns = [
      /(\d+)\s*bids?/i,
      /(\d+)\s*bidders?/i
    ]
    
    for (const pattern of bidPatterns) {
      const match = markdown.match(pattern)
      if (match) {
        return parseInt(match[1])
      }
    }
    
    return undefined
  }

  private static extractCondition(markdown: string, extract: any): string | undefined {
    const conditionPatterns = [
      /condition[:\s]*([^\n\r]+)/i,
      /(new|used|refurbished|for parts)/i
    ]
    
    for (const pattern of conditionPatterns) {
      const match = markdown.match(pattern)
      if (match) {
        return match[1].trim()
      }
    }
    
    return undefined
  }

  private static extractLocation(markdown: string, extract: any): string | undefined {
    const locationPatterns = [
      /location[:\s]*([^\n\r]+)/i,
      /ships? from[:\s]*([^\n\r]+)/i,
      /item location[:\s]*([^\n\r]+)/i
    ]
    
    for (const pattern of locationPatterns) {
      const match = markdown.match(pattern)
      if (match) {
        return match[1].trim()
      }
    }
    
    return undefined
  }

  private static extractShipping(markdown: string, extract: any): string | undefined {
    const shippingPatterns = [
      /shipping[:\s]*([^\n\r]+)/i,
      /delivery[:\s]*([^\n\r]+)/i,
      /postage[:\s]*([^\n\r]+)/i
    ]
    
    for (const pattern of shippingPatterns) {
      const match = markdown.match(pattern)
      if (match) {
        return match[1].trim()
      }
    }
    
    return undefined
  }

  /**
   * Fetch auction data using eBay's public API endpoints
   */
  private static async fetchFromEbayAPI(itemId: string): Promise<EbayAuctionData | null> {
    try {
      // Try eBay's public item API (no authentication required for basic data)
      const apiUrl = `https://open.api.ebay.com/shopping?callname=GetSingleItem&responseencoding=JSON&appid=YourAppI-d&siteid=0&version=967&ItemID=${itemId}&IncludeSelector=Description,Details,ItemSpecifics,ShippingCosts`
      
      console.log('Trying eBay public API:', apiUrl)
      
      const response = await blink.data.fetch({
        url: apiUrl,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      })

      if (response.status === 200 && response.body) {
        const data = typeof response.body === 'string' ? JSON.parse(response.body) : response.body
        
        if (data.Item) {
          const item = data.Item
          return {
            title: item.Title || 'eBay Auction Item',
            currentBid: parseFloat(item.CurrentPrice?.Value || item.ConvertedCurrentPrice?.Value || '0'),
            endTime: new Date(item.EndTime || Date.now() + 24 * 60 * 60 * 1000),
            itemId: item.ItemID || itemId,
            imageUrl: item.PictureURL?.[0] || item.GalleryURL,
            seller: item.Seller?.UserID,
            bidCount: parseInt(item.BidCount || '0'),
            condition: item.ConditionDisplayName,
            location: item.Location,
            shipping: item.ShippingCostSummary?.ShippingServiceCost?.Value ? 
              `${item.ShippingCostSummary.ShippingServiceCost.Value} shipping` : 
              'See item details'
          }
        }
      }
    } catch (error) {
      console.warn('eBay API method failed:', error)
    }

    // Try alternative API approach
    try {
      const altApiUrl = `https://svcs.ebay.com/services/search/FindingService/v1?OPERATION-NAME=findItemsByKeywords&SERVICE-VERSION=1.0.0&SECURITY-APPNAME=YourAppI-d&RESPONSE-DATA-FORMAT=JSON&REST-PAYLOAD&keywords=${itemId}`
      
      const response = await blink.data.fetch({
        url: altApiUrl,
        method: 'GET'
      })

      if (response.status === 200 && response.body) {
        const data = typeof response.body === 'string' ? JSON.parse(response.body) : response.body
        const items = data.findItemsByKeywordsResponse?.[0]?.searchResult?.[0]?.item
        
        if (items && items.length > 0) {
          const item = items[0]
          return {
            title: item.title?.[0] || 'eBay Auction Item',
            currentBid: parseFloat(item.sellingStatus?.[0]?.currentPrice?.[0]?.__value__ || '0'),
            endTime: new Date(item.listingInfo?.[0]?.endTime?.[0] || Date.now() + 24 * 60 * 60 * 1000),
            itemId: item.itemId?.[0] || itemId,
            imageUrl: item.galleryURL?.[0],
            seller: item.sellerInfo?.[0]?.sellerUserName?.[0],
            bidCount: parseInt(item.sellingStatus?.[0]?.bidCount?.[0] || '0'),
            condition: item.condition?.[0]?.conditionDisplayName?.[0],
            location: item.location?.[0],
            shipping: item.shippingInfo?.[0]?.shippingServiceCost?.[0]?.__value__ ?
              `${item.shippingInfo[0].shippingServiceCost[0].__value__} shipping` :
              'See item details'
          }
        }
      }
    } catch (error) {
      console.warn('Alternative eBay API failed:', error)
    }

    return null
  }

  /**
   * Fetch auction data using proxy/CORS bypass methods
   */
  private static async fetchWithProxy(url: string): Promise<EbayAuctionData | null> {
    try {
      // Try using a CORS proxy service
      const proxyUrls = [
        `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
        `https://corsproxy.io/?${encodeURIComponent(url)}`,
        `https://cors-anywhere.herokuapp.com/${url}`
      ]

      for (const proxyUrl of proxyUrls) {
        try {
          console.log('Trying proxy:', proxyUrl)
          
          const response = await blink.data.fetch({
            url: proxyUrl,
            method: 'GET',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          })

          if (response.status === 200 && response.body) {
            let htmlContent = response.body
            
            // Handle different proxy response formats
            if (typeof htmlContent === 'object' && htmlContent.contents) {
              htmlContent = htmlContent.contents
            }
            
            if (typeof htmlContent === 'string') {
              const auctionData = this.parseHTMLContent(htmlContent, this.extractItemId(url))
              if (auctionData && auctionData.currentBid > 0) {
                return auctionData
              }
            }
          }
        } catch (error) {
          console.warn(`Proxy ${proxyUrl} failed:`, error)
        }
      }
    } catch (error) {
      console.warn('All proxy methods failed:', error)
    }

    return null
  }

  /**
   * Parse HTML content directly to extract auction data
   */
  private static parseHTMLContent(html: string, itemId: string): EbayAuctionData | null {
    try {
      // Extract title
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
      const title = titleMatch ? titleMatch[1].replace(' | eBay', '').trim() : 'eBay Auction Item'

      // Extract current price/bid
      const pricePatterns = [
        /US \$([0-9,]+\.?[0-9]*)/g,
        /"currentPrice"[^}]*"value":"([0-9,]+\.?[0-9]*)"/g,
        /"price"[^}]*"value":"([0-9,]+\.?[0-9]*)"/g,
        /\$([0-9,]+\.?[0-9]*)/g
      ]

      let currentBid = 0
      for (const pattern of pricePatterns) {
        const matches = Array.from(html.matchAll(pattern))
        if (matches.length > 0) {
          const price = parseFloat(matches[0][1].replace(/,/g, ''))
          if (!isNaN(price) && price > 0) {
            currentBid = price
            break
          }
        }
      }

      // Extract end time
      const endTimePatterns = [
        /"endTime":"([^"]+)"/,
        /"endTimeMs":([0-9]+)/,
        /ends in[^0-9]*([0-9]+)[^0-9]*([0-9]+)[^0-9]*([0-9]+)/i
      ]

      let endTime = new Date(Date.now() + 24 * 60 * 60 * 1000) // Default 24 hours
      for (const pattern of endTimePatterns) {
        const match = html.match(pattern)
        if (match) {
          if (match[1] && match[1].includes('T')) {
            endTime = new Date(match[1])
            break
          } else if (match[1] && !isNaN(parseInt(match[1]))) {
            endTime = new Date(parseInt(match[1]))
            break
          }
        }
      }

      // Extract bid count
      const bidCountMatch = html.match(/([0-9]+)\s*bids?/i)
      const bidCount = bidCountMatch ? parseInt(bidCountMatch[1]) : undefined

      // Extract seller
      const sellerMatch = html.match(/"sellerUserName":"([^"]+)"/i)
      const seller = sellerMatch ? sellerMatch[1] : undefined

      if (currentBid > 0) {
        return {
          title,
          currentBid,
          endTime,
          itemId,
          seller,
          bidCount,
          condition: undefined,
          location: undefined,
          shipping: undefined
        }
      }
    } catch (error) {
      console.warn('HTML parsing failed:', error)
    }

    return null
  }

  /**
   * Perform scraping with timeout to prevent hanging requests
   */
  private static async performScrapingWithTimeout(url: string, timeoutMs: number): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Scraping timeout after ${timeoutMs}ms`))
      }, timeoutMs)

      // Try scraping with better error handling
      blink.data.scrape(url)
        .then(result => {
          clearTimeout(timeoutId)
          resolve(result)
        })
        .catch(error => {
          clearTimeout(timeoutId)
          console.warn('Scraping failed:', error)
          // Instead of rejecting, return a structured error that we can handle
          reject(new Error(`Scraping failed: ${error.message || 'Unknown error'}`))
        })
    })
  }

  /**
   * Monitor auction for real-time updates
   */
  static async monitorAuction(url: string): Promise<EbayAuctionData> {
    try {
      return await this.extractAuctionData(url)
    } catch (error) {
      console.error('Error monitoring auction:', error)
      throw error
    }
  }

  /**
   * Create enhanced fallback auction data when scraping fails
   */
  private static createEnhancedFallbackAuctionData(url: string, errorType: string): EbayAuctionData {
    const itemId = this.extractItemId(url)
    
    // Generate realistic demo data based on the URL
    const demoTitles = [
      'Vintage Apple iPhone 12 Pro Max 128GB - Unlocked',
      'Sony PlayStation 5 Console - Brand New in Box',
      'MacBook Pro 16" M1 Pro Chip 512GB SSD',
      'Nintendo Switch OLED Model - White',
      'Samsung Galaxy S23 Ultra 256GB - Factory Unlocked',
      'iPad Pro 12.9" M2 Chip 256GB WiFi + Cellular',
      'Dell XPS 13 Laptop Intel i7 16GB RAM 512GB SSD',
      'Canon EOS R5 Mirrorless Camera Body Only',
      'Bose QuietComfort 45 Wireless Headphones',
      'Apple Watch Series 8 45mm GPS + Cellular'
    ]
    
    const demoSellers = [
      'tech_deals_pro',
      'electronics_outlet',
      'gadget_warehouse',
      'premium_electronics',
      'digital_marketplace'
    ]
    
    const demoConditions = ['New', 'Used - Excellent', 'Used - Good', 'Refurbished']
    const demoLocations = ['California, US', 'New York, US', 'Texas, US', 'Florida, US', 'Illinois, US']
    const demoShipping = ['Free shipping', '$9.99 shipping', '$15.00 expedited', 'Local pickup available']
    
    // Generate random but realistic values
    const randomTitle = demoTitles[Math.floor(Math.random() * demoTitles.length)]
    const randomSeller = demoSellers[Math.floor(Math.random() * demoSellers.length)]
    const randomCondition = demoConditions[Math.floor(Math.random() * demoConditions.length)]
    const randomLocation = demoLocations[Math.floor(Math.random() * demoLocations.length)]
    const randomShipping = demoShipping[Math.floor(Math.random() * demoShipping.length)]
    
    // Generate realistic pricing
    const basePrice = Math.floor(Math.random() * 800) + 50 // $50-$850
    const currentBid = basePrice + Math.floor(Math.random() * 200) // Add some bidding activity
    const bidCount = Math.floor(Math.random() * 15) + 1 // 1-15 bids
    
    // Generate end time (1-48 hours from now)
    const hoursFromNow = Math.floor(Math.random() * 48) + 1
    const minutesFromNow = Math.floor(Math.random() * 60)
    const endTime = new Date(Date.now() + (hoursFromNow * 60 + minutesFromNow) * 60 * 1000)
    
    // Create error-specific title suffix
    let titleSuffix = '(Demo Mode - Live Data Unavailable)'
    switch (errorType) {
      case 'server_error':
        titleSuffix = '(Demo Mode - Server Temporarily Unavailable)'
        break
      case 'timeout':
        titleSuffix = '(Demo Mode - Connection Timeout)'
        break
      case 'network':
        titleSuffix = '(Demo Mode - Network Error)'
        break
      case 'blocked':
        titleSuffix = '(Demo Mode - Access Restricted)'
        break
      default:
        titleSuffix = '(Demo Mode - Live Data Unavailable)'
    }
    
    console.log(`Created enhanced fallback auction data (${errorType}):`, {
      title: randomTitle,
      currentBid,
      endTime,
      itemId,
      errorType
    })
    
    return {
      title: `${randomTitle} ${titleSuffix}`,
      currentBid,
      endTime,
      itemId,
      imageUrl: undefined, // No image in demo mode
      seller: randomSeller,
      bidCount,
      condition: randomCondition,
      location: randomLocation,
      shipping: randomShipping
    }
  }

  /**
   * Get auction status (active, ended, etc.)
   */
  static getAuctionStatus(endTime: Date): 'active' | 'ending_soon' | 'ended' {
    const now = new Date()
    const timeRemaining = endTime.getTime() - now.getTime()
    
    if (timeRemaining <= 0) {
      return 'ended'
    } else if (timeRemaining <= 5 * 60 * 1000) { // 5 minutes
      return 'ending_soon'
    } else {
      return 'active'
    }
  }
}