const Parser = require('rss-parser');
const parser = new Parser();

const getNewsHeadlines = async function () {
  const feeds = [
    'https://www.cbsnews.com/latest/rss/main',
    'https://www.cbsnews.com/latest/rss/health',
    'https://www.cbsnews.com/latest/rss/science',
    'https://www.cbsnews.com/latest/rss/entertainment'
  ];

  // Select a random feed
  const selectedFeed = feeds[Math.floor(Math.random() * feeds.length)];
  
  try {
    // Parse the RSS feed
    const feed = await parser.parseURL(selectedFeed);
    
    // Get the 5 most recent articles
    const articles = feed.items.slice(0, 5);
    
    // Format the headlines with summaries
    const headlines = articles.map(article => {
      // Extract title
      const title = article.title || 'No title available';
      
      // Create a two-sentence synopsis from the description
      // Remove HTML tags if present
      let description = article.contentSnippet || article.content || article.description || '';
      description = description.replace(/<[^>]*>/g, '').trim();
      
      // Split into sentences and take first two
      const sentences = description.match(/[^.!?]+[.!?]+/g) || [];
      const synopsis = sentences.slice(0, 2).join(' ').trim() || 'No description available.';
      
      return {
        headline: title,
        summary: synopsis
      };
    });
    
    // Determine the category from the feed URL
    let category = 'general news';
    if (selectedFeed.includes('/health')) category = 'health news';
    else if (selectedFeed.includes('/science')) category = 'science news';
    else if (selectedFeed.includes('/entertainment')) category = 'entertainment news';
    
    return JSON.stringify({
      category: category,
      headlines: headlines
    });
    
  } catch (error) {
    console.error('Error fetching news headlines:', error);
    // Return a fallback response
    return JSON.stringify({
      error: 'Unable to fetch news at this time',
      headlines: []
    });
  }
};

module.exports = getNewsHeadlines;