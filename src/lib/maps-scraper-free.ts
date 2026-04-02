/**
 * Google Maps Scraper - FREE (Puppeteer-based)
 *
 * Scrapt Google Maps direkt im Browser via Puppeteer.
 * KEIN API-Key nötig. KEIN Limit - findet ALLE Ergebnisse.
 *
 * Funktionsweise:
 * 1. Öffnet Google Maps im Headless-Browser
 * 2. Sucht nach dem Keyword
 * 3. Scrollt durch ALLE Ergebnisse (kein 60er Limit wie bei der API)
 * 4. Extrahiert: Name, Adresse, Telefon, Website, Bewertung, Kategorie
 */

import type { ScrapedBusiness, ScrapeResult, ScrapeProgress } from './maps-scraper';
import { delay, extractCity } from './utils';

const GOOGLE_MAPS_URL = 'https://www.google.com/maps/search/';

interface PuppeteerPage {
  goto(url: string, options?: Record<string, unknown>): Promise<unknown>;
  waitForSelector(selector: string, options?: Record<string, unknown>): Promise<unknown>;
  evaluate<T>(fn: (...args: unknown[]) => T, ...args: unknown[]): Promise<T>;
  $$(selector: string): Promise<unknown[]>;
  close(): Promise<void>;
  setViewport(viewport: { width: number; height: number }): Promise<void>;
  click(selector: string): Promise<void>;
  keyboard: { press(key: string): Promise<void> };
}

interface PuppeteerBrowser {
  newPage(): Promise<PuppeteerPage>;
  close(): Promise<void>;
}

/**
 * Scrape Google Maps via Puppeteer - ALLE Ergebnisse, KEIN Limit
 */
export async function scrapeGoogleMapsFree(
  keyword: string,
  onProgress?: (progress: ScrapeProgress) => void,
  maxResults: number = 0, // 0 = unlimited
): Promise<ScrapeResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  let browser: PuppeteerBrowser | null = null;

  // Extract city from keyword for fallback
  const cityMatch = keyword.match(/\b([\wäöüÄÖÜß]{3,})\s*$/);
  const searchCity = cityMatch ? cityMatch[1] : '';

  onProgress?.({
    status: 'running',
    keyword,
    currentPage: 0,
    totalPages: 0,
    businessesFound: 0,
    errors: [],
  });

  try {
    // Dynamic import of puppeteer
    const puppeteer = await import('puppeteer');
    browser = await puppeteer.default.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-features=IsolateOrigins,site-per-process',
        '--lang=de-DE',
      ],
    }) as PuppeteerBrowser;

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });

    // Navigate to Google Maps search
    const searchUrl = `${GOOGLE_MAPS_URL}${encodeURIComponent(keyword)}`;
    console.log(`[Free Scraper] Öffne: ${searchUrl}`);

    await page.goto(searchUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    // Accept cookies if prompted
    try {
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const acceptBtn = buttons.find(b =>
          b.textContent?.includes('Alle akzeptieren') ||
          b.textContent?.includes('Accept all') ||
          b.textContent?.includes('Alle annehmen')
        );
        if (acceptBtn) (acceptBtn as HTMLButtonElement).click();
      });
      await delay(1500);
    } catch {
      // No cookie banner
    }

    // Wait for results panel to load
    await delay(2000);

    // Check if we have a results list
    const hasResults = await page.evaluate(() => {
      // Google Maps results are in a scrollable div with role="feed"
      const feed = document.querySelector('div[role="feed"]');
      if (feed) return true;
      // Alternative: check for result items
      const items = document.querySelectorAll('a[href*="/maps/place/"]');
      return items.length > 0;
    });

    if (!hasResults) {
      console.log('[Free Scraper] Keine Ergebnis-Liste gefunden, prüfe ob einzelnes Ergebnis...');

      // Maybe it redirected to a single business
      const singleResult = await page.evaluate(() => {
        const name = document.querySelector('h1')?.textContent?.trim() || '';
        if (!name) return null;
        const address = document.querySelector('button[data-item-id="address"]')?.textContent?.trim() || '';
        const phone = document.querySelector('button[data-item-id*="phone"]')?.textContent?.trim() || '';
        const website = document.querySelector('a[data-item-id="authority"]')?.getAttribute('href') || '';
        const ratingEl = document.querySelector('span[role="img"]');
        const ratingText = ratingEl?.getAttribute('aria-label') || '';
        const ratingMatch = ratingText.match(/([\d,]+)/);
        const rating = ratingMatch ? parseFloat(ratingMatch[1].replace(',', '.')) : null;
        const reviewMatch = ratingText.match(/(\d+)\s/);
        const reviews = reviewMatch ? parseInt(reviewMatch[1]) : null;
        const category = document.querySelector('button[jsaction*="category"]')?.textContent?.trim() || '';
        return { name, address, phone, website, rating, reviews, category };
      });

      if (singleResult?.name) {
        const business: ScrapedBusiness = {
          name: singleResult.name,
          address: singleResult.address,
          city: extractCity(singleResult.address, searchCity),
          phone: singleResult.phone || null,
          website: singleResult.website || null,
          rating: singleResult.rating,
          reviews: singleResult.reviews,
          category: singleResult.category || null,
          email: null,
          placeId: null,
        };

        return {
          keyword,
          businesses: [business],
          totalFound: 1,
          pagesScraped: 1,
          duration: Date.now() - startTime,
          errors: [],
        };
      }

      return {
        keyword,
        businesses: [],
        totalFound: 0,
        pagesScraped: 0,
        duration: Date.now() - startTime,
        errors: ['Keine Ergebnisse gefunden.'],
      };
    }

    // Scroll through ALL results
    console.log('[Free Scraper] Scrolle durch alle Ergebnisse...');
    let previousCount = 0;
    let stableCount = 0;
    let scrollIteration = 0;

    while (true) {
      scrollIteration++;

      // Scroll the results panel
      const currentCount = await page.evaluate(() => {
        const feed = document.querySelector('div[role="feed"]');
        if (feed) {
          feed.scrollTop = feed.scrollHeight;
          return feed.querySelectorAll(':scope > div > div > a[href*="/maps/place/"]').length
            || feed.querySelectorAll('a[href*="/maps/place/"]').length;
        }
        // Fallback: try scrolling the sidebar
        const sidebar = document.querySelector('div[role="main"]');
        if (sidebar) {
          sidebar.scrollTop = sidebar.scrollHeight;
        }
        return document.querySelectorAll('a[href*="/maps/place/"]').length;
      });

      console.log(`[Free Scraper] Scroll ${scrollIteration}: ${currentCount} Ergebnisse`);

      onProgress?.({
        status: 'running',
        keyword,
        currentPage: scrollIteration,
        totalPages: 0,
        businessesFound: currentCount,
        errors: [],
      });

      // Check if we've reached the end
      if (currentCount === previousCount) {
        stableCount++;
        if (stableCount >= 3) {
          // Check for "end of list" indicator
          const isEnd = await page.evaluate(() => {
            const endText = document.querySelector('span.HlvSq');
            if (endText) return true;
            // Check for "Du hast dir das Ende der Liste angesehen"
            const allSpans = Array.from(document.querySelectorAll('span, p'));
            return allSpans.some(el =>
              el.textContent?.includes('Ende der Liste') ||
              el.textContent?.includes('end of results') ||
              el.textContent?.includes('Du hast dir')
            );
          });

          if (isEnd || stableCount >= 5) {
            console.log(`[Free Scraper] Ende erreicht nach ${scrollIteration} Scrolls`);
            break;
          }
        }
      } else {
        stableCount = 0;
      }
      previousCount = currentCount;

      // Check maxResults limit
      if (maxResults > 0 && currentCount >= maxResults) {
        console.log(`[Free Scraper] Max-Ergebnisse (${maxResults}) erreicht`);
        break;
      }

      // Safety: avoid infinite loops
      if (scrollIteration > 200) {
        console.log('[Free Scraper] Maximale Scroll-Iterationen erreicht (200)');
        break;
      }

      await delay(1200 + Math.random() * 800); // Random delay to avoid detection
    }

    // Now extract ALL business data from the loaded results
    console.log('[Free Scraper] Extrahiere Firmendaten...');

    const rawBusinesses = await page.evaluate(() => {
      const results: Array<{
        name: string;
        address: string;
        phone: string;
        website: string;
        rating: number | null;
        reviews: number | null;
        category: string;
        placeUrl: string;
      }> = [];

      // Find all result links
      const links = document.querySelectorAll('a[href*="/maps/place/"]');
      const seenNames = new Set<string>();

      links.forEach(link => {
        const container = link.closest('div[jsaction]') || link.parentElement?.parentElement;
        if (!container) return;

        const nameEl = container.querySelector('.fontHeadlineSmall, .qBF1Pd, .NrDZNb');
        const name = nameEl?.textContent?.trim() || '';
        if (!name || seenNames.has(name)) return;
        seenNames.add(name);

        // Rating
        const ratingEl = container.querySelector('.MW4etd, span.ZkP5Je');
        const ratingText = ratingEl?.textContent?.trim() || '';
        const rating = ratingText ? parseFloat(ratingText.replace(',', '.')) : null;

        // Reviews count
        const reviewEl = container.querySelector('.UY7F9, span.UY7F9');
        const reviewText = reviewEl?.textContent?.trim() || '';
        const reviewMatch = reviewText.match(/\(?([\d.]+)\)?/);
        const reviews = reviewMatch ? parseInt(reviewMatch[1].replace('.', '')) : null;

        // Category/Type
        const categoryEls = container.querySelectorAll('.W4Efsd span');
        let category = '';
        categoryEls.forEach(el => {
          const text = el.textContent?.trim() || '';
          if (text && !text.includes('·') && text.length > 2 && text.length < 40 && !text.match(/^\d/)) {
            if (!category) category = text;
          }
        });

        // Address - usually in the second line
        const infoLines = container.querySelectorAll('.W4Efsd');
        let address = '';
        let phone = '';
        infoLines.forEach(line => {
          const text = line.textContent?.trim() || '';
          // Phone patterns
          const phoneMatch = text.match(/(\+?\d[\d\s\-/()]{6,})/);
          if (phoneMatch && !phone) phone = phoneMatch[1].trim();
          // Address: contains PLZ or common address indicators
          if (!address && (text.match(/\d{5}/) || text.match(/str\.|weg|platz|ring|allee/i))) {
            // Clean up: remove leading dots and category text
            const parts = text.split('·').map(p => p.trim());
            for (const part of parts) {
              if (part.match(/\d{5}/) || part.match(/str\.|weg|platz|ring|allee/i)) {
                address = part;
                break;
              }
            }
          }
        });

        // Website from the link
        const websiteEl = container.querySelector('a[href*="http"]:not([href*="google"])');
        const website = websiteEl?.getAttribute('href') || '';

        const placeUrl = (link as HTMLAnchorElement).href || '';

        results.push({
          name,
          address,
          phone,
          website,
          rating,
          reviews,
          category,
          placeUrl,
        });
      });

      return results;
    }) as Array<{
      name: string;
      address: string;
      phone: string;
      website: string;
      rating: number | null;
      reviews: number | null;
      category: string;
      placeUrl: string;
    }>;

    console.log(`[Free Scraper] ${rawBusinesses.length} Firmen extrahiert. Lade Details...`);

    // For businesses missing phone/website, try to load their detail pages
    const businesses: ScrapedBusiness[] = [];
    let detailIndex = 0;

    for (const raw of rawBusinesses) {
      detailIndex++;

      // If we already have good data, skip detail fetch
      if (raw.phone && raw.website) {
        businesses.push({
          name: raw.name,
          address: raw.address,
          city: extractCity(raw.address, searchCity),
          phone: raw.phone || null,
          website: raw.website || null,
          rating: raw.rating,
          reviews: raw.reviews,
          category: raw.category || null,
          email: null,
          placeId: null,
        });
        continue;
      }

      // Try to get details by clicking the result
      if (raw.placeUrl && (!raw.phone || !raw.website)) {
        try {
          // Only fetch details for first 100 to avoid taking too long
          if (detailIndex <= 100) {
            const detailPage = await browser!.newPage();
            await detailPage.setViewport({ width: 1280, height: 900 });
            await detailPage.goto(raw.placeUrl, { waitUntil: 'networkidle2', timeout: 15000 });
            await delay(1000);

            const details = await detailPage.evaluate(() => {
              const phone = document.querySelector('button[data-item-id*="phone"]')?.textContent?.trim() || '';
              const website = document.querySelector('a[data-item-id="authority"]')?.getAttribute('href') || '';
              const address = document.querySelector('button[data-item-id="address"]')?.textContent?.trim() || '';
              return { phone, website, address };
            });

            await detailPage.close();

            businesses.push({
              name: raw.name,
              address: details.address || raw.address,
              city: extractCity(details.address || raw.address, searchCity),
              phone: details.phone || raw.phone || null,
              website: details.website || raw.website || null,
              rating: raw.rating,
              reviews: raw.reviews,
              category: raw.category || null,
              email: null,
          placeId: null,
            });

            if (detailIndex % 10 === 0) {
              onProgress?.({
                status: 'running',
                keyword,
                currentPage: detailIndex,
                totalPages: Math.min(rawBusinesses.length, 100),
                businessesFound: businesses.length,
                errors: [],
              });
            }

            continue;
          }
        } catch (err) {
          // Detail fetch failed, use what we have
          console.log(`[Free Scraper] Detail-Fehler für "${raw.name}": ${err instanceof Error ? err.message : 'Unbekannt'}`);
        }
      }

      businesses.push({
        name: raw.name,
        address: raw.address,
        city: extractCity(raw.address, searchCity),
        phone: raw.phone || null,
        website: raw.website || null,
        rating: raw.rating,
        reviews: raw.reviews,
        category: raw.category || null,
        email: null,
        placeId: null,
      });
    }

    console.log(`[Free Scraper] Fertig: ${businesses.length} Firmen für "${keyword}"`);

    const result: ScrapeResult = {
      keyword,
      businesses,
      totalFound: businesses.length,
      pagesScraped: scrollIteration,
      duration: Date.now() - startTime,
      errors,
    };

    onProgress?.({
      status: businesses.length > 0 ? 'completed' : 'error',
      keyword,
      currentPage: scrollIteration,
      totalPages: scrollIteration,
      businessesFound: businesses.length,
      errors,
    });

    return result;
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Unbekannter Fehler';
    errors.push(errMsg);
    console.error(`[Free Scraper] Fehler: ${errMsg}`);

    onProgress?.({
      status: 'error',
      keyword,
      currentPage: 0,
      totalPages: 0,
      businessesFound: 0,
      errors,
    });

    return {
      keyword,
      businesses: [],
      totalFound: 0,
      pagesScraped: 0,
      duration: Date.now() - startTime,
      errors,
    };
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch {
        // Ignore close errors
      }
    }
  }
}
