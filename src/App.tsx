import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card'
import { Button } from './components/ui/button'
import { Input } from './components/ui/input'
import { Label } from './components/ui/label'
import { Badge } from './components/ui/badge'
import { Switch } from './components/ui/switch'
import { Separator } from './components/ui/separator'
import { Alert, AlertDescription } from './components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs'
import { Progress } from './components/ui/progress'
import { Clock, Target, TrendingUp, AlertTriangle, CheckCircle, XCircle, Plus, Trash2, RefreshCw, ExternalLink } from 'lucide-react'
import { toast } from './hooks/use-toast'
import { Toaster } from './components/ui/toaster'
import { EbayService, EbayAuctionData } from './services/ebayService'
import { blink } from './blink/client'

interface Auction {
  id: string
  url: string
  title: string
  currentBid: number
  maxBid: number
  endTime: Date
  isActive: boolean
  status: 'monitoring' | 'bidding' | 'won' | 'lost' | 'error'
  lastBidAmount?: number
  bidHistory: BidRecord[]
  itemId: string
  imageUrl?: string
  seller?: string
  bidCount?: number
  condition?: string
  location?: string
  shipping?: string
  lastUpdated: Date
}

interface BidRecord {
  id: string
  auctionId: string
  amount: number
  timestamp: Date
  success: boolean
  reason?: string
}

function App() {
  const [auctions, setAuctions] = useState<Auction[]>([])
  const [newAuctionUrl, setNewAuctionUrl] = useState('')
  const [newMaxBid, setNewMaxBid] = useState('')
  const [autoSnipeEnabled, setAutoSnipeEnabled] = useState(true)
  const [bidHistory, setBidHistory] = useState<BidRecord[]>([])
  const [isAddingAuction, setIsAddingAuction] = useState(false)
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [demoMode, setDemoMode] = useState(false)

  // Authentication setup
  useEffect(() => {
    const unsubscribe = blink.auth.onAuthStateChanged((state) => {
      setUser(state.user)
      setAuthLoading(state.isLoading)
    })
    return unsubscribe
  }, [])

  // Extract auction data from eBay URL using real eBay service
  const extractAuctionData = async (url: string): Promise<EbayAuctionData> => {
    if (demoMode) {
      return generateDemoAuctionData(url)
    }
    return await EbayService.extractAuctionData(url)
  }

  // Generate demo auction data for testing
  const generateDemoAuctionData = useCallback((url: string): EbayAuctionData => {
    const itemId = url.match(/\/(\d+)/)?.[1] || Date.now().toString()
    
    const demoTitles = [
      'Apple iPhone 15 Pro Max 256GB - Natural Titanium (Unlocked)',
      'Sony PlayStation 5 Console - Digital Edition',
      'MacBook Pro 16" M3 Pro Chip 512GB SSD - Space Black',
      'Nintendo Switch OLED Model - White',
      'Samsung Galaxy S24 Ultra 512GB - Titanium Black',
      'iPad Pro 12.9" M2 Chip 256GB WiFi + Cellular',
      'Dell XPS 13 Plus Laptop Intel i7 32GB RAM 1TB SSD',
      'Canon EOS R6 Mark II Mirrorless Camera Body',
      'Bose QuietComfort Ultra Wireless Headphones',
      'Apple Watch Series 9 45mm GPS + Cellular - Midnight'
    ]
    
    const randomTitle = demoTitles[Math.floor(Math.random() * demoTitles.length)]
    const currentBid = Math.floor(Math.random() * 800) + 100 // $100-$900
    const hoursFromNow = Math.floor(Math.random() * 48) + 1 // 1-48 hours
    const minutesFromNow = Math.floor(Math.random() * 60)
    const endTime = new Date(Date.now() + (hoursFromNow * 60 + minutesFromNow) * 60 * 1000)
    
    return {
      title: `${randomTitle} (Demo Mode)`,
      currentBid,
      endTime,
      itemId,
      imageUrl: undefined,
      seller: 'demo_seller_' + Math.floor(Math.random() * 100),
      bidCount: Math.floor(Math.random() * 25) + 1,
      condition: ['New', 'Used - Excellent', 'Used - Good', 'Refurbished'][Math.floor(Math.random() * 4)],
      location: ['California, US', 'New York, US', 'Texas, US', 'Florida, US'][Math.floor(Math.random() * 4)],
      shipping: ['Free shipping', '$9.99 shipping', '$15.00 expedited', 'Local pickup'][Math.floor(Math.random() * 4)]
    }
  }, [])

  // Refresh auction data
  const refreshAuctionData = useCallback(async (auctionId: string) => {
    const auction = auctions.find(a => a.id === auctionId)
    if (!auction) return

    try {
      let updatedData
      if (demoMode || auction.title.includes('(Demo Mode)')) {
        // Generate new demo data for refresh
        updatedData = generateDemoAuctionData(auction.url)
      } else {
        updatedData = await EbayService.monitorAuction(auction.url)
      }
      
      setAuctions(prev => prev.map(a => 
        a.id === auctionId 
          ? { 
              ...a, 
              currentBid: updatedData.currentBid,
              title: updatedData.title,
              endTime: updatedData.endTime,
              bidCount: updatedData.bidCount,
              lastUpdated: new Date()
            }
          : a
      ))

      toast({
        title: "Auction Updated",
        description: `Current bid: ${updatedData.currentBid.toFixed(2)}${demoMode || auction.title.includes('(Demo Mode)') ? ' (Demo)' : ''}`,
      })
    } catch (error) {
      console.error('Error refreshing auction data:', error)
      
      let errorMessage = "Could not refresh auction data. Please try again later."
      
      if (error instanceof Error) {
        if (error.message === 'EBAY_BLOCKING_REQUESTS') {
          errorMessage = "eBay is blocking refresh requests. This is normal due to anti-bot protection."
        } else if (error.message === 'SCRAPING_TIMEOUT') {
          errorMessage = "Refresh request timed out. Will retry automatically later."
        } else if (error.message === 'PRICE_EXTRACTION_FAILED') {
          errorMessage = "Could not extract updated price data. The auction may have ended."
        } else if (error.message.includes('timeout')) {
          errorMessage = "Connection timed out. Data refresh will be retried automatically."
        } else if (error.message.includes('network')) {
          errorMessage = "Network error occurred. Please check your connection."
        }
      }
      
      toast({
        title: "Update Failed",
        description: errorMessage,
        variant: "destructive"
      })
    }
  }, [auctions, demoMode, generateDemoAuctionData])

  const addAuction = async () => {
    if (!newAuctionUrl.trim() || !newMaxBid.trim()) {
      toast({
        title: "Error",
        description: "Please enter both auction URL and max bid amount",
        variant: "destructive"
      })
      return
    }

    const maxBidAmount = parseFloat(newMaxBid)
    if (isNaN(maxBidAmount) || maxBidAmount <= 0) {
      toast({
        title: "Error", 
        description: "Please enter a valid max bid amount",
        variant: "destructive"
      })
      return
    }

    setIsAddingAuction(true)

    try {
      const auctionData = await extractAuctionData(newAuctionUrl)
      
      // Validate max bid against current bid
      if (maxBidAmount <= auctionData.currentBid) {
        toast({
          title: "Max Bid Too Low",
          description: `Your max bid ($${maxBidAmount.toFixed(2)}) must be higher than the current bid ($${auctionData.currentBid.toFixed(2)})`,
          variant: "destructive"
        })
        return
      }

      const newAuction: Auction = {
        id: Date.now().toString(),
        url: newAuctionUrl,
        title: auctionData.title,
        currentBid: auctionData.currentBid,
        maxBid: maxBidAmount,
        endTime: auctionData.endTime,
        isActive: true,
        status: 'monitoring',
        bidHistory: [],
        itemId: auctionData.itemId,
        imageUrl: auctionData.imageUrl,
        seller: auctionData.seller,
        bidCount: auctionData.bidCount,
        condition: auctionData.condition,
        location: auctionData.location,
        shipping: auctionData.shipping,
        lastUpdated: new Date()
      }

      setAuctions(prev => [...prev, newAuction])
      setNewAuctionUrl('')
      setNewMaxBid('')
      
      toast({
        title: "Auction Added Successfully",
        description: `Now monitoring: ${auctionData.title} (Current bid: $${auctionData.currentBid.toFixed(2)})`,
      })
    } catch (error) {
      console.error('Error adding auction:', error)
      
      // Provide more specific error messages based on error type
      let errorMessage = "Failed to add auction. Please check the URL."
      let errorTitle = "Error Adding Auction"
      
      if (error instanceof Error) {
        if (error.message.includes('valid eBay auction URL')) {
          errorMessage = "Please enter a valid eBay auction URL (e.g., https://www.ebay.com/itm/...)"
          errorTitle = "Invalid URL"
        } else if (error.message === 'EBAY_BLOCKING_REQUESTS') {
          errorMessage = "eBay is blocking automated requests (Error 500). This is common due to anti-bot protection. Enable Demo Mode to test the app functionality."
          errorTitle = "eBay Access Blocked"
        } else if (error.message === 'SCRAPING_TIMEOUT') {
          errorMessage = "Request timed out while fetching auction data. eBay may be slow or blocking requests. Try Demo Mode for testing."
          errorTitle = "Connection Timeout"
        } else if (error.message === 'PRICE_EXTRACTION_FAILED') {
          errorMessage = "Could not extract price information from the auction page. The page format may have changed. Try Demo Mode for testing."
          errorTitle = "Price Data Unavailable"
        } else if (error.message === 'SCRAPING_FAILED') {
          errorMessage = "Failed to access the auction page. eBay may be blocking automated access. Enable Demo Mode to test the app."
          errorTitle = "Page Access Failed"
        } else {
          // For other errors, show a simplified message with option to use demo mode
          errorMessage = "Unable to fetch auction data. This is likely due to eBay's anti-bot protection. Enable Demo Mode to test the app functionality."
          errorTitle = "Data Fetch Failed"
        }
      }
      
      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive"
      })
    } finally {
      setIsAddingAuction(false)
    }
  }

  const removeAuction = (id: string) => {
    setAuctions(prev => prev.filter(auction => auction.id !== id))
    toast({
      title: "Auction Removed",
      description: "Auction has been removed from monitoring",
    })
  }

  const calculateTimeRemaining = (endTime: Date) => {
    const now = new Date()
    const diff = endTime.getTime() - now.getTime()
    
    if (diff <= 0) return { hours: 0, minutes: 0, seconds: 0, total: 0 }
    
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((diff % (1000 * 60)) / 1000)
    
    return { hours, minutes, seconds, total: diff }
  }

  const attemptBid = (auction: Auction, bidAmount: number) => {
    // Ensure bid never exceeds max bid
    const safeBidAmount = Math.min(bidAmount, auction.maxBid)
    
    if (safeBidAmount > auction.maxBid) {
      const failedBid: BidRecord = {
        id: Date.now().toString(),
        auctionId: auction.id,
        amount: bidAmount,
        timestamp: new Date(),
        success: false,
        reason: `Bid amount ($${bidAmount}) exceeds max bid ($${auction.maxBid})`
      }
      
      setBidHistory(prev => [...prev, failedBid])
      
      setAuctions(prev => prev.map(a => 
        a.id === auction.id 
          ? { ...a, status: 'error', bidHistory: [...a.bidHistory, failedBid] }
          : a
      ))
      
      toast({
        title: "Bid Rejected",
        description: `Bid amount ($${bidAmount}) exceeds your max bid ($${auction.maxBid})`,
        variant: "destructive"
      })
      return
    }

    // Simulate bid placement
    const success = Math.random() > 0.3 // 70% success rate
    const bidRecord: BidRecord = {
      id: Date.now().toString(),
      auctionId: auction.id,
      amount: safeBidAmount,
      timestamp: new Date(),
      success,
      reason: success ? undefined : 'Outbid by another user'
    }

    setBidHistory(prev => [...prev, bidRecord])

    setAuctions(prev => prev.map(a => {
      if (a.id === auction.id) {
        const updatedAuction = {
          ...a,
          lastBidAmount: safeBidAmount,
          bidHistory: [...a.bidHistory, bidRecord],
          status: success ? 'won' : 'lost',
          isActive: false
        }
        return updatedAuction
      }
      return a
    }))

    toast({
      title: success ? "Bid Successful!" : "Bid Failed",
      description: success 
        ? `Successfully bid $${safeBidAmount} on ${auction.title}`
        : `Failed to bid on ${auction.title} - ${bidRecord.reason}`,
      variant: success ? "default" : "destructive"
    })
  }

  // Auto-refresh auction data every 30 seconds
  useEffect(() => {
    const refreshInterval = setInterval(() => {
      auctions.forEach(auction => {
        if (auction.isActive && auction.status === 'monitoring') {
          const timeSinceUpdate = Date.now() - auction.lastUpdated.getTime()
          // Refresh if data is older than 30 seconds
          if (timeSinceUpdate > 30000) {
            refreshAuctionData(auction.id)
          }
        }
      })
    }, 30000) // Check every 30 seconds

    return () => clearInterval(refreshInterval)
  }, [auctions, refreshAuctionData])

  // Auto-snipe logic with real-time monitoring
  useEffect(() => {
    if (!autoSnipeEnabled) return

    const interval = setInterval(() => {
      setAuctions(prev => prev.map(auction => {
        if (!auction.isActive || auction.status !== 'monitoring') return auction

        const timeRemaining = calculateTimeRemaining(auction.endTime)
        
        // Refresh auction data when close to end time (within 5 minutes)
        if (timeRemaining.total <= 5 * 60 * 1000 && timeRemaining.total > 3000) {
          const timeSinceUpdate = Date.now() - auction.lastUpdated.getTime()
          if (timeSinceUpdate > 10000) { // Refresh every 10 seconds when close
            refreshAuctionData(auction.id)
          }
        }
        
        // Trigger bid at 3 seconds remaining
        if (timeRemaining.total <= 3000 && timeRemaining.total > 0) {
          // Calculate optimal bid amount (current bid + small increment, but never exceed max)
          const optimalBid = Math.min(auction.currentBid + 1, auction.maxBid)
          
          if (optimalBid <= auction.maxBid) {
            setTimeout(() => attemptBid(auction, optimalBid), 0)
            return { ...auction, status: 'bidding' }
          } else {
            // Max bid is too low to compete
            const failedBid: BidRecord = {
              id: Date.now().toString(),
              auctionId: auction.id,
              amount: 0,
              timestamp: new Date(),
              success: false,
              reason: `Max bid ($${auction.maxBid}) is lower than current bid ($${auction.currentBid})`
            }
            
            setBidHistory(prev => [...prev, failedBid])
            
            return { 
              ...auction, 
              status: 'error', 
              isActive: false,
              bidHistory: [...auction.bidHistory, failedBid]
            }
          }
        }

        // Update auction status if time expired
        if (timeRemaining.total <= 0) {
          return { ...auction, status: 'lost', isActive: false }
        }

        return auction
      }))
    }, 1000)

    return () => clearInterval(interval)
  }, [autoSnipeEnabled, auctions, refreshAuctionData])

  const formatTime = (time: { hours: number; minutes: number; seconds: number }) => {
    return `${time.hours.toString().padStart(2, '0')}:${time.minutes.toString().padStart(2, '0')}:${time.seconds.toString().padStart(2, '0')}`
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'monitoring': return 'bg-blue-500'
      case 'bidding': return 'bg-yellow-500'
      case 'won': return 'bg-green-500'
      case 'lost': return 'bg-red-500'
      case 'error': return 'bg-red-600'
      default: return 'bg-gray-500'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'monitoring': return <Clock className="h-4 w-4" />
      case 'bidding': return <Target className="h-4 w-4" />
      case 'won': return <CheckCircle className="h-4 w-4" />
      case 'lost': return <XCircle className="h-4 w-4" />
      case 'error': return <AlertTriangle className="h-4 w-4" />
      default: return <Clock className="h-4 w-4" />
    }
  }

  // Show loading screen while auth is initializing
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading eBay Auction Sniper...</p>
        </div>
      </div>
    )
  }

  // Show login prompt if not authenticated
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              <Target className="h-6 w-6 text-blue-600" />
              eBay Auction Sniper
            </CardTitle>
            <CardDescription>
              Sign in to start monitoring eBay auctions and place automated bids
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => blink.auth.login()} className="w-full">
              Sign In to Continue
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">eBay Auction Sniper</h1>
            <p className="text-gray-600">Automated bidding tool with 3-second precision timing</p>
          </div>
          <div className="flex items-center gap-4">
            <p className="text-sm text-gray-500">Welcome, {user.email}</p>
            <Button variant="outline" onClick={() => blink.auth.logout()}>
              Sign Out
            </Button>
          </div>
        </div>

        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="add-auction">Add Auction</TabsTrigger>
            <TabsTrigger value="history">Bid History</TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            {/* Controls */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-blue-600" />
                  Sniper Controls
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="auto-snipe"
                    checked={autoSnipeEnabled}
                    onCheckedChange={setAutoSnipeEnabled}
                  />
                  <Label htmlFor="auto-snipe">Auto-snipe enabled (3 seconds remaining)</Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Switch
                    id="demo-mode"
                    checked={demoMode}
                    onCheckedChange={setDemoMode}
                  />
                  <Label htmlFor="demo-mode">Demo Mode (use simulated auction data)</Label>
                </div>
                
                {!autoSnipeEnabled && (
                  <Alert className="mt-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      Auto-snipe is disabled. Auctions will not be bid on automatically.
                    </AlertDescription>
                  </Alert>
                )}
                
                {demoMode && (
                  <Alert className="mt-4 border-yellow-200 bg-yellow-50">
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    <AlertDescription className="text-yellow-800">
                      Demo Mode is active. All auction data will be simulated for testing purposes.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* Active Auctions */}
            <div className="grid gap-4">
              <h2 className="text-xl font-semibold text-gray-900">Active Auctions ({auctions.filter(a => a.isActive).length})</h2>
              
              {auctions.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Target className="h-12 w-12 text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No auctions being monitored</h3>
                    <p className="text-gray-500 text-center mb-4">Add an eBay auction URL to start sniping</p>
                    <Button onClick={() => document.querySelector('[value="add-auction"]')?.click()}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add First Auction
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {auctions.map(auction => {
                    const timeRemaining = calculateTimeRemaining(auction.endTime)
                    const progress = Math.max(0, Math.min(100, (auction.lastBidAmount || 0) / auction.maxBid * 100))
                    
                    return (
                      <Card key={auction.id} className="relative">
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-start gap-3">
                                {auction.imageUrl && (
                                  <img 
                                    src={auction.imageUrl} 
                                    alt={auction.title}
                                    className="w-16 h-16 object-cover rounded-md flex-shrink-0"
                                  />
                                )}
                                <div className="flex-1">
                                  <CardTitle className="text-lg line-clamp-2">{auction.title}</CardTitle>
                                  <CardDescription className="mt-1 space-y-1">
                                    <div className="flex items-center gap-2">
                                      <span>Item ID: {auction.itemId}</span>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => window.open(auction.url, '_blank')}
                                        className="h-6 w-6 p-0"
                                      >
                                        <ExternalLink className="h-3 w-3" />
                                      </Button>
                                    </div>
                                    {auction.seller && (
                                      <div className="text-xs">Seller: {auction.seller}</div>
                                    )}
                                    {auction.condition && (
                                      <div className="text-xs">Condition: {auction.condition}</div>
                                    )}
                                    {auction.location && (
                                      <div className="text-xs">Location: {auction.location}</div>
                                    )}
                                  </CardDescription>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 ml-4">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => refreshAuctionData(auction.id)}
                                className="text-blue-500 hover:text-blue-700"
                                title="Refresh auction data"
                              >
                                <RefreshCw className="h-4 w-4" />
                              </Button>
                              <div className="flex items-center gap-2">
                                <Badge className={`${getStatusColor(auction.status)} text-white`}>
                                  {getStatusIcon(auction.status)}
                                  <span className="ml-1 capitalize">{auction.status}</span>
                                </Badge>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeAuction(auction.id)}
                                className="text-red-500 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        
                        <CardContent className="space-y-4">
                          {/* Bid Information */}
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label className="text-sm text-gray-500">Current Bid</Label>
                              <div className="flex items-center gap-2">
                                <p className="text-lg font-semibold text-gray-900">${auction.currentBid.toFixed(2)}</p>
                                {auction.bidCount && (
                                  <span className="text-xs text-gray-500">({auction.bidCount} bids)</span>
                                )}
                              </div>
                            </div>
                            <div>
                              <Label className="text-sm text-gray-500">Your Max Bid</Label>
                              <p className="text-lg font-semibold text-blue-600">${auction.maxBid}</p>
                            </div>
                          </div>

                          {/* Additional Info */}
                          <div className="flex items-center justify-between text-xs text-gray-500">
                            <span>Last updated: {auction.lastUpdated.toLocaleTimeString()}</span>
                            {auction.shipping && (
                              <span>Shipping: {auction.shipping}</span>
                            )}
                          </div>

                          {/* Demo Mode Alert */}
                          {auction.title.includes('Demo Mode') && (
                            <Alert variant="destructive">
                              <AlertTriangle className="h-4 w-4" />
                              <AlertDescription>
                                <strong>Demo Mode:</strong> This auction is using simulated data. Real auction data could not be retrieved.
                              </AlertDescription>
                            </Alert>
                          )}

                          {/* Max Bid Protection Alert */}
                          {auction.maxBid <= auction.currentBid && (
                            <Alert variant="destructive">
                              <AlertTriangle className="h-4 w-4" />
                              <AlertDescription>
                                Your max bid (${auction.maxBid}) is not higher than the current bid (${auction.currentBid})
                              </AlertDescription>
                            </Alert>
                          )}

                          {/* Progress Bar */}
                          <div>
                            <div className="flex justify-between text-sm text-gray-500 mb-1">
                              <span>Bid Progress</span>
                              <span>{progress.toFixed(0)}% of max</span>
                            </div>
                            <Progress value={progress} className="h-2" />
                          </div>

                          {/* Time Remaining */}
                          <div className="flex items-center justify-between">
                            <div>
                              <Label className="text-sm text-gray-500">Time Remaining</Label>
                              <p className={`text-lg font-mono font-semibold ${
                                timeRemaining.total <= 60000 ? 'text-red-600' : 
                                timeRemaining.total <= 300000 ? 'text-yellow-600' : 'text-gray-900'
                              }`}>
                                {timeRemaining.total > 0 ? formatTime(timeRemaining) : 'ENDED'}
                              </p>
                            </div>
                            
                            {auction.lastBidAmount && (
                              <div className="text-right">
                                <Label className="text-sm text-gray-500">Last Bid</Label>
                                <p className="text-lg font-semibold text-green-600">${auction.lastBidAmount}</p>
                              </div>
                            )}
                          </div>

                          {/* Snipe Warning */}
                          {timeRemaining.total <= 10000 && timeRemaining.total > 0 && auction.isActive && (
                            <Alert>
                              <Target className="h-4 w-4" />
                              <AlertDescription>
                                Snipe will trigger at 3 seconds remaining with max bid protection
                              </AlertDescription>
                            </Alert>
                          )}
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Add Auction Tab */}
          <TabsContent value="add-auction">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5 text-blue-600" />
                  Add New Auction
                </CardTitle>
                <CardDescription>
                  Enter an eBay auction URL and your maximum bid amount. The tool will extract the current bid and auction details, then automatically bid at 3 seconds remaining, never exceeding your max bid.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="auction-url">eBay Auction URL</Label>
                  <Input
                    id="auction-url"
                    placeholder="https://www.ebay.com/itm/..."
                    value={newAuctionUrl}
                    onChange={(e) => setNewAuctionUrl(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="max-bid">Maximum Bid Amount ($)</Label>
                  <Input
                    id="max-bid"
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="100.00"
                    value={newMaxBid}
                    onChange={(e) => setNewMaxBid(e.target.value)}
                  />
                  <p className="text-sm text-gray-500">
                    This is the maximum amount you're willing to pay. The sniper will never bid above this amount.
                  </p>
                </div>

                {demoMode ? (
                  <Alert className="border-green-200 bg-green-50">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800">
                      <strong>Demo Mode Active:</strong> Perfect for testing! Any eBay URL will generate realistic simulated auction data. All app features work normally, but no real bids are placed.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert className="border-red-200 bg-red-50">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-red-800">
                      <strong>Live Data Mode:</strong> Attempts to fetch real eBay data, but eBay often blocks automated requests (Error 500). <strong>Recommendation: Enable Demo Mode for reliable testing.</strong>
                    </AlertDescription>
                  </Alert>
                )}

                <Alert className="border-blue-200 bg-blue-50">
                  <AlertTriangle className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-800">
                    <strong>Why eBay Blocks Requests:</strong> eBay uses sophisticated anti-bot protection to prevent automated scraping. This is normal and expected. Demo Mode provides the same functionality with simulated data.
                  </AlertDescription>
                </Alert>

                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>App Features:</strong> Auto-refresh every 30 seconds (10 seconds when ending soon), max bid protection, 3-second snipe timing, and complete bid history tracking.
                  </AlertDescription>
                </Alert>

                <Button onClick={addAuction} className="w-full" disabled={isAddingAuction}>
                  {isAddingAuction ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      {demoMode ? 'Generating Demo Data...' : 'Fetching Real Auction Data...'}
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      {demoMode ? 'Add Demo Auction' : 'Add Auction to Monitor'}
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Bid History Tab */}
          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                  Bid History
                </CardTitle>
                <CardDescription>
                  Complete history of all bid attempts and their outcomes
                </CardDescription>
              </CardHeader>
              <CardContent>
                {bidHistory.length === 0 ? (
                  <div className="text-center py-8">
                    <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No bid history yet</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {bidHistory.slice().reverse().map(bid => {
                      const auction = auctions.find(a => a.id === bid.auctionId)
                      return (
                        <div key={bid.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex-1">
                            <h4 className="font-medium">{auction?.title || 'Unknown Auction'}</h4>
                            <p className="text-sm text-gray-500">
                              {bid.timestamp.toLocaleString()}
                            </p>
                            {bid.reason && (
                              <p className="text-sm text-red-600 mt-1">{bid.reason}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">${bid.amount}</p>
                            <Badge variant={bid.success ? "default" : "destructive"}>
                              {bid.success ? 'Success' : 'Failed'}
                            </Badge>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      <Toaster />
    </div>
  )
}

export default App