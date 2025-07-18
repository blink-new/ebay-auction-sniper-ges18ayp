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
   * Extract auction data from eBay URL - simplified approach with better error handling
   */
  static async extractAuctionData(url: string): Promise<EbayAuctionData> {
    // Validate eBay URL format
    if (!this.isValidEbayUrl(url)) {
      throw new Error('Please enter a valid eBay auction URL')
    }

    const processedUrl = this.preprocessEbayUrl(url)
    const itemId = this.extractItemId(processedUrl)
    
    console.log('Attempting to get eBay auction data for:', processedUrl)
    console.log('Extracted item ID:', itemId)

    // Try scraping with shorter timeout and better error handling
    try {
      console.log('Attempting web scraping...')
      const pageData = await this.performScrapingWithTimeout(processedUrl, 8000)
      console.log('Scraping successful, parsing auction data...')
      
      const auctionData = this.parseEbayPageData(pageData, itemId)
      
      // Validate that we got meaningful data
      if (auctionData.currentBid > 0) {
        console.log('Successfully extracted auction data:', auctionData)
        return auctionData
      } else {
        throw new Error('No valid price data found')
      }
    } catch (error) {
      console.warn('Scraping failed:', error)
      
      // Provide specific error types for better handling
      if (error instanceof Error) {
        if (error.message.includes('500')) {
          throw new Error('EBAY_BLOCKING_REQUESTS')
        } else if (error.message.includes('timeout')) {
          throw new Error('SCRAPING_TIMEOUT')
        } else if (error.message.includes('No valid price data')) {
          throw new Error('PRICE_EXTRACTION_FAILED')
        } else {
          throw new Error('SCRAPING_FAILED')
        }
      }
      
      throw new Error('UNKNOWN_ERROR')
    }
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
    
    // Enhanced price extraction patterns
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
          console.log(`Found auction price: ${price} using pattern: ${pattern}`)
          return price
        }
      }
    }
    
    // If no price found, throw error
    console.error('No valid price found in auction data')
    throw new Error('Unable to extract current bid/price from auction')
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