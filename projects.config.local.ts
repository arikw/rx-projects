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
    // scrubEmails stays at its default `true`. Replace each scrubbed
    // email with the on-site contact page URL — the scrub helper
    // auto-wraps it as a markdown link (the URL is both the href and
    // the visible text). Body renderer adds `target="_blank"` so the
    // link opens in a new tab.
    contactReplacement: '/contact',
  },
  user: {
    ...baseConfig.user,
    github: 'arikw',
    npm: 'arik.w',
    docker: 'arikwe',
    bio: 'Software engineer by day, tinkerer by night—building browser extensions, libraries, and web apps. Reach me on [GitHub](https://github.com/arikw).',
  },
  // Friendly-URL overrides for Chrome Web Store extensions whose
  // connector-supplied ids are 32-character opaque hashes. Without
  // these, `/projects/jdmiahadpnljimfcnfaebjggbfkjkgan/` would be the
  // canonical URL. Map keys are the original project ids; values are
  // the URL slug to use under /projects/.
  urlSlugs: {
    ...baseConfig.urlSlugs,
    jdmiahadpnljimfcnfaebjggbfkjkgan: 'feed-cleaner',
    jmjbmlfmmendpkpiggcfpjcpbbpedhha: 'popper-stopper-pro',
    mcdpnidfhfjfbafmpppcplcejgepadbo: 'auto-replay-for-youtube',
  },
  ui: {
    ...baseConfig.ui,
    /* Site loads light-first for new visitors. Their toggle override
       still wins on every subsequent visit. */
    defaultTheme: 'light',
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
      // Long-form CWS body recovered from Wayback snapshot
      // 20141224182724 (`<pre class="webstore-Vb-nd-bc-Db-Wb">`). The
      // dashboard renders this through the same Marked + sanitize
      // pipeline used for GitHub READMEs / Docker full_description —
      // so we lean on existing rendering and skip a new schema field.
      body: [
        '**The first dedicated pop-under blocker!**',
        '',
        'Block all these annoying popups and popunders that pop no matter where you click on a page. No configurations. Easy options. Transparent in use.',
        '',
        'When a popup or a popunder is identified and blocked, a notification appears.',
        '',
        'You can view the blocked content by clicking on its link in the notification.',
        '',
        '_Allow always_ will suppress the blocking of any future content generated by the current website and add it to the whitelist.',
        '',
        "The whitelist can be managed via the extension's options page.",
        '',
        "If you're signed-in to Chrome, your settings will be synced across devices.",
        '',
        "Your privacy is deeply respected and there's absolutely no data whatsoever sent anywhere. The extension is practically off-line in terms of communications.",
      ].join('\n'),
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
      body: `
## Description

Graphing calculators are instrumental in teaching and learning mathematics. It is an environment that supports conceptual understanding of functions in general, and school algebra and real analysis in particular. Especially, it enhances connections between graphic and symbolic representations. A major objective of algebra teaching is equipping learners with tools to mathematize their perceptions. A multi-representational approach has the potential to shift the focus of solving even traditional problems from assigning and solving for an unknown to analyzing the various processes and relations among those processes. The integration of multiple representations of function creates opportunities for developing a wider range of solution methods to traditional problems. Zooming in on the use of the graphing calculator, researchers point on four patterns and modes of use: computational tool, data analysis tool, visualizing tool, and checking tool.

**Dynamic transformations** are a unique facility of **Graph2Go** .

Dynamic control involves the direct manipulation of an object or a representation of a mathematical object. As the driving input is the letter-symbolic one, the transformations are carried out on the numbers involved in the function’s expression. Thus, by parameterizing an example we turn it into a family of functions. Research suggests that the kinesthetic relation between the user and the object on the screen can have an important role in developing a deeper understanding of the mathematical concept.

## Features

Basic features of Graph2Go:

Graph2Go is a special purpose graphing calculator that operates for given sets of function expressions. Additional sets will become available for downloading from this site. The given families of function expressions and the tools that support easy changes of any given example have been designed for fast and easy use with the small keyboard.
`,
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
      body: `
## Description

**Solve2Go ** supports solving equations and inequalities by means of conjectures based on visual thinking. Conjectures can be refuted or supported by examples provided by the tool, and should be proved using symbolic manipulations on paper.

In many mathematical investigations we encounter the need to compare two functions. **Solve2Go** supports comparisons of two types:

**Equations:** when we want to know for which values of x the two functions are equal.

**Inequalities:** when we want to know for which values of x one function is greater than the other.

When the two functions involved are linear, we call the comparison a linear comparison. When at least one of the functions is not linear, we refer to a non-linear comparison. Non-linear comparisons form a wide and rich field of study

## Features

Users specify two function expressions by choosing each expression from a list of given parametric function expressions. **Solve2Go** randomly chooses numeric values for the parameters and graphs the two functions. It also marks points of intersection when they exist and are visible on screen.

To explore solutions of other equations or inequalities of the same (selected) type, it is recommended to use the interactive change of the constants and coefficients in each expression, transform the graphs, and view whether and how solutions are changing. The design of **Solve2Go** is based on the special features of **Graph2Go** (see the **Graph2Go** features).
`,
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
      body: `
## Description

Explorations with **Quad2Go** are especially appropriate for 11-12 year old students. Teaching geometry to students of this age focuses on the critical attributes of quadrilaterals and on the hierarchical relations among them. Learning means identifying critical attributes and non-critical attributes. For example, "four sides," "two pairs of parallel sides," or "two pairs of equal opposite angles" are some of the critical attributes of a parallelogram; "two long sides and two short sides" or "two acute angles and two obtuse angles" are non-critical attributes. Learning in this sense means learning to analyze the attributes of different quads, to distinguish between their critical and non-critical attributes, and learning the hierarchy among quads. **Quad2Go** provides many examples of randomly constructed quads. Each example can be changed by dragging either its vertices or sides.

## Features

**Quad2Go ** is a handy tool for learning about quadrilaterals by generating examples, observing, and experimenting with examples with a view toward forming generalized conjectures. Similarly to frequently used Dynamic Geometry Environments (DGE) such as the Geometric Supposer, Cabri Geometry, and the Geometer Sketchpad, **Quad2Go** offers geometric objects, tools to manipulate them, and measurement tools. It is limited to quadrilaterals and the construction of diagonals. **Quad2Go** allows users to construct, view, and transform quadrilaterals compatible with the ones constructed with straight edge and compass, to measure lengths, angles, and areas, and to manipulate the construction by dragging and transforming its shape. Dragging allows changing a shape by direct translation of parts of its components on the screen. Learning by DGE is closely related to theories of constructivist learning, in which meaning is constructed through the learner’s active participation.
`,
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
      body: `
## Description

**Sketch2Go** encourages visual exploration of phenomena by providing qualitative indication of the ways in which the sketch drawn by the user changes. The sketch is a diagrammatic representation that attempts to help the viewer focus on the principles rather than on tedious details of the represented phenomenon. Phenomenon can refer to processes outside of mathematics (e.g., physical temporal phenomena) or to mathematical phenomena (e.g., a function with three extrema). Moving students beyond plotting and reading points to interpreting the global meaning of graphs and the functional relationships that they describe has been identified as a major goal of mathematics education.

Tools like **Sketch2Go** enable the bypassing of algebraic symbols as the only channel into mathematical representation, and motivate students to experiment with a given situation, analyze it, and reflect upon it, even when the situation is too complicated for them to approach symbolically. The visual analysis that emerges from work with such tools is different from that which arises from work with algebraic symbols or numerical tables.

## Features

**Sketch2Go** is a qualitative graphing tool. Graphs are sketched using seven icons representing constant, increasing, and decreasing functions that change at constant, increasing, or decreasing rates. It is based on original R&D carried out by Schwartz and Yerushalmy (1995) and Shternberg & Yerushalmy (2001), who propose an intermediate bridging representation based on the function and its vocabulary. The seven graphic icons describe the change in both the function and its rate of change. **Sketch2Go** is a version of the [Qualitative Derivative Grapher](http://calculus.cet.ac.il/Lib/item.aspx?sID=97A7647E-0BC9-4A72-8B27-5CD1BD9CBD36&bPopup=1&bFitSize=1) programmed by Alexander Zilber for CET (Centre for Educational Technology).

Mathematical modeling cannot be fully accomplished by this qualitative sign system of constant, increasing, and decreasing functions. But the set of seven signs supports forming a mathematical construction with language developed from acquaintance with physical scenarios, helping lay the foundations of learning pre-calculus and calculus. **Sketch2Go** supports the abstraction of everyday phenomena using a small set of mathematical signs that can be manipulated on screen as semi-concrete objects.
`,
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
      body: `
## Description

**Fit2Go** supports exploration and modeling activities. It supports data collection by proposing a model that can appropriately describe the user’s data. The tool highlights the numeric aspects of a phenomenon. Together, **Sketch2Go** and ** Fit2Go** provide a comprehensive view of models and modeling.

**Fit2Go** is suited for building a conceptual understanding of mathematical facts that are usually known only as "rules of thumb." Everyone knows that two points define a line. Fewer would know that three points define a parabola. High school students can prove it either in their algebra course by solving a system of equations or in their analytic geometry studies by implementing the geometric properties of the parabola. **Fit2Go** provides a wide repertoire of choices that fit given sets or subsets of data, and elicits questions and conjectures that can lead to formal solutions and proofs.

## Features

**Fit2Go** is a linear and quadratic function graphing tool and curve fitter. Students can view a phenomenon, identify variables, conduct experiments, and take measurements in order to construct models of the phenomena. **Fit2Go** offers linear or quadratic models by presenting graphs and expressions of functions that can fit the data. **Fit2Go ** provides an easy visual way of enter the data by dynamically viewing the point and reading its values. After choosing the type of model (an important decision that should be made by the user rather than automatically interpreted by the tool), **Fit2Go** presents a specific line (if only two data points are marked) or a specific quadratic function (if three points are marked). Interesting cases occur when too many or too few points are marked. **Fit2Go** does not attempt to fit a model to all points by interpolation. Rather, it randomly plots optional curves that fit a subset of the marked points and allows the user to alternate between the random options. If there are too few constrains, **Fit2Go** graphs a family of graphs, which it alternates according to the user requests.
`,
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
