// Local override of projects.config.ts. GITIGNORED — never commit this file.
//
// The loader shallow-merges this over the base config at build time when
// present. Use it for real handles you want to test locally but not push to
// the public repo.

import baseConfig from './projects.config';
import type { ProjectsConfig } from './src/types/config';

const config: ProjectsConfig = {
  ...baseConfig,
  deployment: {
    ...baseConfig.deployment,
    site: 'https://wzmn.net',
    base: '/projects',
  },
  meta: {
    ...baseConfig.meta,
    siteTitle: 'My Projects',
    siteDescription: "RX (Arik's) Projects — My dev projects, packages, and tooling",
    siteTagline: "Things I've built — with the live numbers",
    siteAbout: `Almost everything below started the same way: I went looking for something, couldn't find it, and built it myself. Most are solo from first commit to last; a smaller group are ones where I came in as a meaningful contributor and shaped where they went. Scratching that itch is still what keeps me shipping — and if you spot something worth a comment, send it my way.`,
    defaultLanguage: 'en',
  },
  user: {
    ...baseConfig.user,
    github: 'arikw',
    npm: 'arik.w',
    docker: 'arikwe',
    bio: 'Software engineer by day, tinkerer by night—building browser extensions, libraries, and web apps. Reach me on [GitHub](https://github.com/arikw).',
  },
  sources: {
    ...baseConfig.sources,
    chrome: {
      ...baseConfig.sources.chrome,
      extensionIds: [
        // Live on CWS:
        'fimgfedafeadlieiabdeeaodndnlbhid', // Extensions Reloader
        'jmjbmlfmmendpkpiggcfpjcpbbpedhha', // Popper Stopper Pro
        'agpmfmfpldoabkmhjanenelnnplfcidm', // Fullscreen Magic
        'gleiglfcmildnecmodgoeijleblhobjk', // WriteRight
        // Taken down — only the chromestats mirror returns data for these:
        'jdmiahadpnljimfcnfaebjggbfkjkgan', // Feed Cleaner
        'mcdpnidfhfjfbafmpppcplcejgepadbo', // Auto Replay for YouTube
      ],
    },
    gnome: {
      ...baseConfig.sources.gnome,
      extensionIds: [
        5835, // RX Input Layout Switcher
      ],
    },
    gplay: {
      ...baseConfig.sources.gplay,
      packages: [
        'net.wzmn.games.brokencalc',  // The Broken Calculator Game
        'net.wzmn.games.lightsprank', // Lights Out Prank
        'com.arik.games.cardflipper', // BabyTV - Memory Game
        'net.wzmn.redalert',          // צבע אדום — real-time Israeli rocket alerts
        'net.wzmn.mivzakon',          // מבזקון — real-time Hebrew news flashes
      ],
    },
    // appbrain + apkpure inherit enabled:true from the base config and both
    // read the gplay.packages list above.
    // chromestats inherits enabled:true from base; reads chrome.extensionIds above.
    stackoverflow: {
      ...baseConfig.sources.stackoverflow,
      userId: '1655245',
    },
  },
  // Exact cumulative install totals from the Play Console (summed from the
  // monthly download reports). Keyed by ORIGIN resource id; injected as an
  // authoritative `origin` that wins reconciliation over AppBrain's "10,000+"
  // tier mirror. The snapshot keeps AppBrain's raw value.
  origins: {
    'google-play:net.wzmn.games.brokencalc': {
      asOf: '2018-07-16',
      stats: { installs: { value: 11185, exact: true } },
    },
    'google-play:net.wzmn.games.lightsprank': {
      asOf: '2018-07-16',
      stats: { installs: { value: 16522, exact: true } },
    },
    // Authoritative first-release years from the Chrome Web Store Developer
    // dashboard — chrome-stats's `creationDate` is when it indexed the
    // extension, not when the extension was actually published.
    'chrome:fimgfedafeadlieiabdeeaodndnlbhid': { firstReleased: 2012 }, // Extensions Reloader (6 Oct 2012)
    'chrome:mcdpnidfhfjfbafmpppcplcejgepadbo': { firstReleased: 2012 }, // Auto Replay for YouTube (25 Feb 2012)
    'chrome:jdmiahadpnljimfcnfaebjggbfkjkgan': { firstReleased: 2017 }, // Feed Cleaner (7 May 2017)
    'chrome:gleiglfcmildnecmodgoeijleblhobjk': { firstReleased: 2023 }, // WriteRight (20 Apr 2023)
    'chrome:agpmfmfpldoabkmhjanenelnnplfcidm': { firstReleased: 2023 }, // Fullscreen Magic (18 Apr 2023)
  },
  featured: [
    // 'chrome-extensions-reloader'
  ],
  // Retired Firefox addons — sourced from Wayback Machine snapshots of the
  // (now-dead) AMO listings. Each entry's `stats.downloads` carries a 20%
  // conservative deflation against the AMO-reported number to compensate
  // for AMO's listing-page click-event counter overstating unique installs
  // (reinstalls, churn round-trips, etc. inflate the raw count by an
  // unknown but non-trivial multiplier; Mozilla never published a ratio).
  // See projects.config.ts comments and docs/skills/add-manual-entry.md.
  manual: [
    {
      slug: 'youtube-auto-replay',
      title: 'YouTube Auto Replay',
      description:
        'Enables automatic replay of a YouTube video, or watching a part of it again and again.',
      // Live AMO URL 404s. Card URL = 2015 Wayback snapshot (the headline-
      // stats source). Histogram + reviews come from the later 2018
      // snapshot since AMO's older snapshot doesn't expose the per-star
      // breakdown.
      url: 'https://web.archive.org/web/20150426111831/https://addons.mozilla.org/en-US/firefox/addon/youtube-auto-replay-11636/',
      source: 'firefox',
      kind: 'extension',
      language: 'JavaScript',
      tags: ['firefox', 'extension', 'browser', 'youtube', 'video'],
      // Same author / same concept as the Chrome extension. Merge the two
      // cards via the explicit cross-platform pointer so the dashboard
      // shows a single "Auto Replay for YouTube" card with both platforms.
      relatesToProjectId: 'mcdpnidfhfjfbafmpppcplcejgepadbo',
      // First release: 2009 per the addon's source-code copyright notice.
      // AMO's "Released" date reflects a later signed re-upload, not the
      // true first publication.
      year: 2009,
      asOf: '2015-04-26',
      retired: true,
      icon: 'https://web.archive.org/web/20150426111831im_/https://addons.cdn.mozilla.net/user-media/addon_icons/11/11636-64.png?modified=1421399580',
      screenshots: [
        'https://web.archive.org/web/20150426111831im_/https://addons.cdn.mozilla.net/user-media/previews/full/68/68064.png?modified=1352871665',
        'https://web.archive.org/web/20150426111831im_/https://addons.cdn.mozilla.net/user-media/previews/full/82/82304.png?modified=1352900469',
        'https://web.archive.org/web/20150426111831im_/https://addons.cdn.mozilla.net/user-media/previews/full/82/82306.png?modified=1352900469',
        'https://web.archive.org/web/20150426111831im_/https://addons.cdn.mozilla.net/user-media/previews/full/71/71777.png?modified=1352871665',
      ],
      stats: {
        // From 2015 main snapshot (#daily-users): 28,614 users.
        users: 28614,
        // AMO reported 439,939 lifetime downloads (interactionCount
        // UserDownloads). Using a conservative 20% estimation
        // (439939 × 0.2 = 87987.8 → 87988) to deflate AMO's
        // overcounted listing-page click events into a defensible
        // "unique installers" lower bound.
        downloads: 87988,
        // Histogram + count from the 2018-11-01 reviews snapshot;
        // average derived from the histogram (317 / 89 = 3.56).
        // The 2015 main page showed average 4.05 over 63 ratings;
        // the 2018 numbers reflect the addon's decline (ratings
        // skewed harder once it stopped working with newer FF).
        rating: { average: 3.56, count: 89, histogram: [22, 2, 8, 18, 39] },
      },
      reviews: [
        {
          rating: 5,
          body: 'Like many other add-ons that haven\'t been updated with the latest YouTube layout, you can click on the top right icon of the YouTube page and choose "Switch back to YouTube Classics layout". This will bring you back to the layout before the update. The replay button will reappear where it\'s supposed to be. Works perfectly, 100%. Cheers and replay on!',
          ts: '2017-05-16',
          source: 'firefox',
        },
        {
          rating: 5,
          body: 'been using this for long time, doing it job as described. But, options missing till using the latest version of youtube. Keep up the good work!',
          ts: '2017-05-11',
          source: 'firefox',
        },
        {
          rating: 4,
          body: 'I\'ve tried several looping add-ons, and this is the one that works the best AND (most importantly to me) offers a "from this > to this" function. Can just use right click > Loop, but this add-on is helpful when you just wanna loop the best part of a video.',
          source: 'firefox',
        },
        {
          rating: 5,
          body: 'Install, Video show.... wait, Perfect replay :)',
          source: 'firefox',
        },
      ],
    },
    {
      slug: 'back-to-google',
      title: 'Back to Google',
      description:
        "Go back to your last Google results page from your current tab's history list.",
      // Live AMO URL 404s. Card URL = 2016 Wayback snapshot (the
      // headline-stats source for users/downloads). Histogram + reviews
      // come from the 2017 reviews snapshot.
      url: 'https://web.archive.org/web/20160205165208/https://addons.mozilla.org/en-US/firefox/addon/back-to-google/',
      source: 'firefox',
      kind: 'extension',
      language: 'JavaScript',
      tags: ['firefox', 'extension', 'browser', 'search', 'productivity'],
      year: 2008,
      asOf: '2016-02-05',
      retired: true,
      icon: 'https://web.archive.org/web/20160205165208im_/https://addons.cdn.mozilla.net/user-media/addon_icons/7/7206-64.png?modified=1281058539',
      screenshots: [
        // Wayback only has the 2017-archived variant of the screenshot
        // (the 2016 page referenced `?modified=1331247702`, a newer mtime
        // that was never captured). Same image record — different
        // cache-busting query string — just sourced from the 2017 crawl.
        'https://web.archive.org/web/20170918010719im_/https://addons.cdn.mozilla.net/user-media/previews/full/22/22335.png?modified=1331218902',
      ],
      stats: {
        // From 2016 main snapshot (#daily-users): 382 users.
        users: 382,
        // AMO reported 31,581 lifetime downloads (interactionCount
        // UserDownloads). Using a conservative 20% estimation
        // (31581 × 0.2 = 6316.2 → 6316) to deflate AMO's overcounted
        // listing-page click events into a defensible lower bound.
        downloads: 6316,
        // Histogram + count from the 2017-09-18 reviews snapshot; the
        // headline 4.2 average was already in the 2016 main page and
        // matches the 2017 histogram-derived value.
        rating: { average: 4.2, count: 15, histogram: [0, 1, 2, 5, 7] },
      },
      reviews: [
        {
          rating: 5,
          body: 'I find this a really useful little add on that I use all the time',
          ts: '2010-10-31',
          source: 'firefox',
        },
        {
          rating: 5,
          body: 'I downloaded this thinking it could be of use in certain situations. Instead, it became a regular part of viewing google results, like the Search and Back buttons. Good thinking.',
          ts: '2009-07-25',
          source: 'firefox',
        },
        {
          rating: 4,
          body: 'I\'ll add another star if you add a hotkey (sendkey).',
          ts: '2009-06-11',
          source: 'firefox',
        },
        {
          rating: 5,
          body: 'One of the handiest addons I have used. :)',
          ts: '2009-04-20',
          source: 'firefox',
        },
        {
          rating: 5,
          body: 'This is simple and exactly what I had in mind when I googled "back to google".',
          ts: '2009-01-25',
          source: 'firefox',
        },
        {
          rating: 5,
          body: "I think it is a great idea. I'm always opening tons of tabs and keeping google separate because I don't want backtrack to my search. Often I end up with many google searches left open.",
          ts: '2008-06-30',
          source: 'firefox',
        },
      ],
    },
    // ----------------------------------------------------------------
    // Poper Blocker — Chrome popup/popunder blocker SOLD on 2014-09-12.
    // The live CWS listing at bkkbcggn... still exists but belongs to
    // the new owner now, so we deliberately DO NOT add the id to
    // sources.chrome.extensionIds — that would scrape the current
    // owner's stats and credit them to us. Headline numbers come
    // from a Wayback snapshot taken three months after the sale
    // (the closest record to the handover date). Icon URL points at
    // Wayback too; richer screenshots can be added once local
    // archive assets are recovered. Year is a best-guess placeholder.
    // ----------------------------------------------------------------
    {
      slug: 'poper-blocker',
      title: 'Poper Blocker',
      description:
        'Blocks all these annoying popups and popunders that pop no matter where you click on a page.',
      url: 'https://web.archive.org/web/20141224182724/https://chrome.google.com/webstore/detail/poper-blocker/bkkbcggnhapdmkeljlodobbkopceiche',
      source: 'chrome',
      kind: 'extension',
      language: 'JavaScript',
      tags: ['chrome-extension', 'browser', 'popup', 'blocker'],
      year: 2012,
      asOf: '2014-12-24',
      retired: true,
      // The og:image URL CWS embeds in the page uses a sizing suffix
      // (=s128-h128) that Wayback never crawled, so it 404s. The actual
      // <img src> URLs ON the page use s26 for the icon and s640-h400
      // for the marquee — those WERE crawled and still serve 200. Card
      // art picks `banner` first so the marquee wins and the s26 icon
      // is just there as a fallback / chip-badge source.
      icon: 'https://web.archive.org/web/20141224182724im_/https://lh4.googleusercontent.com/9fFpYKngoFXpxFSZa7ymWlIc55oe_1pKKbFjsOF0_-sKiDHoqE2NTggq2hiURFmXUrdS3giWuTw=s26-h26-e365',
      banner: 'https://web.archive.org/web/20141224182724im_/https://lh4.googleusercontent.com/uQyWPXQwDhwntFRhea8fma6czvNP-2j_Wt1fBjo1aBM14aUgNWY7RftlmtE81Rvc1Qt101XfuA=s640-h400-e365',
      stats: {
        // Headline numbers from the 2014-12-24 Wayback snapshot of the
        // CWS listing — interactionCount "UserDownloads:250,600" and
        // aggregateRating ratingValue 4.459 / ratingCount 917.
        users: 250600,
        rating: { average: 4.46, count: 917 },
      },
    },
    // ----------------------------------------------------------------
    // Math4Mobile — five J2ME math apps for feature phones (2005-era).
    // Download counts + screenshots scraped 2026-06-02 from
    // https://www.math4mobile.com/download/<slug>. The page is still
    // live (HTTP 200), so `url` points at the live page rather than
    // an archive snapshot. No deflation applied — math4mobile is not
    // AMO; the 20% AMO-deflation rule doesn't apply here. Raw counts
    // are stored verbatim. Author / grant info on the page is
    // deliberately omitted (research-project PII). J2ME is dead, so
    // every entry is retired: true.
    // ----------------------------------------------------------------
    {
      // bg colour sampled from the screenshot's average — pale blue-gray matches
      // the J2ME-era phone screen tone, lets the device frame breathe instead
      // of cropping. Same `thumbFit: 'contain'` pattern applies to all five.
      thumbFit: 'contain',
      thumbBg: '#d6dfea',
      slug: 'graph2go',
      title: 'Graph2Go',
      description:
        'A special-purpose graphing calculator for J2ME feature phones that operates on given sets of function expressions, with dynamic controls for exploring derivatives, integrals, and inflection points.',
      url: 'https://www.math4mobile.com/download/graph2go',
      homepage: 'https://www.math4mobile.com/',
      source: 'math4mobile',
      kind: 'mobile',
      language: 'Java',
      tags: ['j2me', 'mobile', 'math', 'education', 'graphing', 'calculator'],
      year: 2005,
      asOf: '2026-06-02',
      retired: true,
      // J2ME platform reached effective end-of-life around 2014; the
      // download page is still up so we keep crediting stats, but the
      // lifespan range ends here.
      retiredAt: '2014-12-31',
      screenshots: [
        'https://www.math4mobile.com/wp-content/images/Graph2Go-Screenshot.gif',
      ],
      stats: {
        // Total Downloads from the live download page (verbatim,
        // no deflation — math4mobile reports its own server-side
        // count, not a click-event proxy).
        downloads: 115454,
      },
    },
    {
      thumbFit: 'contain',
      thumbBg: '#b9d0e1',
      slug: 'solve2go',
      title: 'Solve2Go',
      description:
        'A J2ME tool for solving equations and inequalities conjectures based on visual thinking. Conjectures can be refuted or supported by tool-provided examples, then proved symbolically on paper.',
      url: 'https://www.math4mobile.com/download/solve2go',
      homepage: 'https://www.math4mobile.com/',
      source: 'math4mobile',
      kind: 'mobile',
      language: 'Java',
      tags: ['j2me', 'mobile', 'math', 'education', 'algebra', 'equations'],
      year: 2005,
      asOf: '2026-06-02',
      retired: true,
      // J2ME platform reached effective end-of-life around 2014; the
      // download page is still up so we keep crediting stats, but the
      // lifespan range ends here.
      retiredAt: '2014-12-31',
      screenshots: [
        'https://www.math4mobile.com/wp-content/images/Solve2Go-Screenshot.gif',
      ],
      stats: {
        downloads: 89800,
      },
    },
    {
      thumbFit: 'contain',
      thumbBg: '#bdd1e5',
      slug: 'quad2go',
      title: 'Quad2Go',
      description:
        'A J2ME tool for learning about quadrilaterals by generating examples, observing properties, and experimenting with diagonals, angles, and parallel sides to form generalised geometric conjectures.',
      url: 'https://www.math4mobile.com/download/quad2go',
      homepage: 'https://www.math4mobile.com/',
      source: 'math4mobile',
      kind: 'mobile',
      language: 'Java',
      tags: ['j2me', 'mobile', 'math', 'education', 'geometry', 'quadrilaterals'],
      year: 2005,
      asOf: '2026-06-02',
      retired: true,
      // J2ME platform reached effective end-of-life around 2014; the
      // download page is still up so we keep crediting stats, but the
      // lifespan range ends here.
      retiredAt: '2014-12-31',
      screenshots: [
        'https://www.math4mobile.com/wp-content/images/Quad2Go-Screenshot.gif',
      ],
      stats: {
        downloads: 35524,
      },
    },
    {
      thumbFit: 'contain',
      thumbBg: '#c1cddd',
      slug: 'sketch2go',
      title: 'Sketch2Go',
      description:
        'A qualitative graphing tool for J2ME phones. Graphs are sketched using seven icons representing constant, increasing, and decreasing functions that change at constant, increasing, or decreasing rates.',
      url: 'https://www.math4mobile.com/download/sketch2go',
      homepage: 'https://www.math4mobile.com/',
      source: 'math4mobile',
      kind: 'mobile',
      language: 'Java',
      tags: ['j2me', 'mobile', 'math', 'education', 'graphing', 'modeling'],
      year: 2005,
      asOf: '2026-06-02',
      retired: true,
      // J2ME platform reached effective end-of-life around 2014; the
      // download page is still up so we keep crediting stats, but the
      // lifespan range ends here.
      retiredAt: '2014-12-31',
      screenshots: [
        'https://www.math4mobile.com/wp-content/images/Sketch2Go-Screenshot.gif',
      ],
      stats: {
        downloads: 49253,
      },
    },
    {
      thumbFit: 'contain',
      thumbBg: '#d8e0e9',
      slug: 'fit2go',
      title: 'Fit2Go',
      description:
        'A linear and quadratic function graphing tool and curve fitter for J2ME phones. Students view a phenomenon, identify variables, conduct experiments, take measurements, and construct models.',
      url: 'https://www.math4mobile.com/download/fit2go',
      homepage: 'https://www.math4mobile.com/',
      source: 'math4mobile',
      kind: 'mobile',
      language: 'Java',
      tags: ['j2me', 'mobile', 'math', 'education', 'curve-fitting', 'modeling'],
      year: 2005,
      asOf: '2026-06-02',
      retired: true,
      // J2ME platform reached effective end-of-life around 2014; the
      // download page is still up so we keep crediting stats, but the
      // lifespan range ends here.
      retiredAt: '2014-12-31',
      screenshots: [
        'https://www.math4mobile.com/wp-content/images/Fit2Go-Screenshot.gif',
      ],
      stats: {
        downloads: 44295,
      },
    },
  ],
};

export default config;
