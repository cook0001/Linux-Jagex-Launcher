export interface ResourceItem {
  id: string;
  game: 'rs3' | 'osrs' | 'dragonwilds';
  title: string;
  url: string;
  category: string;
  description: string;
  icon: string;
}

export const COMMUNITY_RESOURCES: ResourceItem[] = [
  // =========================================================================
  // RuneScape 3 (RS3)
  // =========================================================================
  {
    id: 'rs3-wiki',
    game: 'rs3',
    title: 'RuneScape 3 Official Wiki',
    url: 'https://runescape.wiki/',
    category: 'Wiki & Guides',
    description: 'The definitive player-run encyclopedia with quest walkthroughs, bestiary, drop tables, and skill calculators.',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="#e5b352" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path><path d="M12 6v6"></path><path d="M9 9h6"></path></svg>`
  },
  {
    id: 'rs3-runekit',
    game: 'rs3',
    title: 'RuneKit Reforged (Alt1 for Linux)',
    url: 'https://github.com/Jcapehart2/RuneKit-Reforged',
    category: 'Linux Overlay',
    description: 'Native Linux Python 3 & Qt6 Alt1 companion client. Runs Clue Solvers, AFK Warden alerts, XP metrics, and Farming timers.',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line><path d="M7 8l3 3-3 3"></path><line x1="13" y1="14" x2="17" y2="14"></line></svg>`
  },
  {
    id: 'rs3-alt1-electron',
    game: 'rs3',
    title: 'Alt1 Electron (Linux AppImage)',
    url: 'https://github.com/arroquw/alt1-electron',
    category: 'Linux Overlay',
    description: 'Cross-platform Electron rewrite of Alt1 Toolkit with ready-to-run Linux AppImages for instant clue solving overlays.',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="#9feaf9" stroke-width="1.8"><ellipse cx="12" cy="12" rx="11" ry="4.5" transform="rotate(30 12 12)"></ellipse><ellipse cx="12" cy="12" rx="11" ry="4.5" transform="rotate(90 12 12)"></ellipse><ellipse cx="12" cy="12" rx="11" ry="4.5" transform="rotate(150 12 12)"></ellipse><circle cx="12" cy="12" r="2" fill="#9feaf9"></circle></svg>`
  },
  {
    id: 'rs3-pvme',
    game: 'rs3',
    title: 'PvM Encyclopedia (PvME)',
    url: 'https://pvme.io/',
    category: 'Combat & Bossing',
    description: 'Gold-standard high-level combat guides, optimal ability bar setups, invention perks, and rotation theorycrafting.',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><line x1="9.5" y1="9" x2="14.5" y2="14"></line><line x1="14.5" y1="9" x2="9.5" y2="14"></line></svg>`
  },
  {
    id: 'rs3-runeapps',
    game: 'rs3',
    title: 'RuneApps Web Tools',
    url: 'https://runeapps.org/',
    category: 'Calculators & Map',
    description: 'Browser-based clue puzzle solvers, XP calculators, and interactive Gielinor world map (runs with zero install).',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>`
  },
  {
    id: 'rs3-ely',
    game: 'rs3',
    title: 'Ely.gg Price Tracker',
    url: 'https://www.ely.gg/',
    category: 'Market & Economy',
    description: 'Real-time market price tracker and verified trade transactions for rares, hero items, and high-end gear.',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="#a855f7" stroke-width="2"><polygon points="6 3 18 3 22 9 12 22 2 9"></polygon><line x1="12" y1="22" x2="12" y2="9"></line><line x1="2" y1="9" x2="22" y2="9"></line><line x1="6" y1="3" x2="10.5" y2="9"></line><line x1="18" y1="3" x2="13.5" y2="9"></line></svg>`
  },
  {
    id: 'rs3-guide',
    game: 'rs3',
    title: 'The RS Guide',
    url: 'https://thersguide.com/',
    category: 'Progression Guides',
    description: 'Account progression roadmaps, Ironman guides, and comprehensive daily & weekly task checklists.',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon></svg>`
  },
  {
    id: 'rs3-ge',
    game: 'rs3',
    title: 'Official Grand Exchange',
    url: 'https://secure.runescape.com/m=itemdb_rs/',
    category: 'Economy',
    description: 'Jagex official item market database, daily trading volumes, and historical price graphs.',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="#e5b352" stroke-width="2"><circle cx="12" cy="12" r="9"></circle><path d="M12 6v12M15 9.5a3 3 0 0 0-6 0c0 3 6 2 6 5a3 3 0 0 1-6 0"></path></svg>`
  },
  {
    id: 'rs3-reddit',
    game: 'rs3',
    title: 'r/runescape Community',
    url: 'https://www.reddit.com/r/runescape/',
    category: 'Community Hub',
    description: 'The primary RuneScape 3 community for news, player guides, game discussions, and JMod interaction.',
    icon: `<svg viewBox="0 0 24 24" fill="#ff4500"><path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.56 12 8 12.56 8 13.25c0 .69.56 1.25 1.25 1.25.69 0 1.25-.56 1.25-1.25C10.5 12.56 9.94 12 9.25 12zm5.5 0c-.69 0-1.25.56-1.25 1.25 0 .69.56 1.25 1.25 1.25.69 0 1.25-.56 1.25-1.25 0-.69-.56-1.25-1.25-1.25zm-5.465 4.31a.488.488 0 0 0-.083.688c.618.79 1.637 1.252 2.798 1.252s2.18-.462 2.798-1.252a.489.489 0 0 0-.083-.688.49.49 0 0 0-.688.083c-.456.582-1.229.932-2.027.932-.798 0-1.571-.35-2.027-.932a.486.486 0 0 0-.688-.083z"/></svg>`
  },

  // =========================================================================
  // Old School RuneScape (OSRS)
  // =========================================================================
  {
    id: 'osrs-wiki',
    game: 'osrs',
    title: 'Old School RuneScape Wiki',
    url: 'https://oldschool.runescape.wiki/',
    category: 'Wiki & Data',
    description: 'World-class official wiki featuring drop rate tables, quest walkthroughs, and skill training charts.',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="#c09643" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>`
  },
  {
    id: 'osrs-dps',
    game: 'osrs',
    title: 'OSRS Wiki DPS Calculator',
    url: 'https://tools.runescape.wiki/osrs-dps/',
    category: 'Combat / DPS',
    description: 'Official damage-per-second calculator to benchmark gear setups, prayers, and enemy defense.',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="22" y1="12" x2="18" y2="12"></line><line x1="6" y1="12" x2="2" y2="12"></line><line x1="12" y1="6" x2="12" y2="2"></line><line x1="12" y1="22" x2="12" y2="18"></line><circle cx="12" cy="12" r="3"></circle></svg>`
  },
  {
    id: 'osrs-getracker',
    game: 'osrs',
    title: 'GE Tracker',
    url: 'https://www.ge-tracker.com/',
    category: 'Market & Flipping',
    description: 'High-frequency Grand Exchange price charts, margin flipping tools, buy limits, and market trends.',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>`
  },
  {
    id: 'osrs-questhelper',
    game: 'osrs',
    title: 'Quest Helper (RuneLite)',
    url: 'https://github.com/Zoinkwiz/quest-helper',
    category: 'Questing Plugin',
    description: 'Official repository and guide for the #1 RuneLite plugin providing in-game quest navigation.',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path><line x1="12" y1="7" x2="12" y2="13"></line><line x1="9" y1="10" x2="15" y2="10"></line></svg>`
  },
  {
    id: 'osrs-wiseoldman',
    game: 'osrs',
    title: 'Wise Old Man',
    url: 'https://wiseoldman.net/',
    category: 'Player Tracking',
    description: 'Track XP gains, boss kill leaderboards, collection logs, and competitive clan competitions.',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="#0284c7" stroke-width="2"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"></path></svg>`
  },
  {
    id: 'osrs-temple',
    game: 'osrs',
    title: 'TempleOSRS',
    url: 'https://templeosrs.com/',
    category: 'Efficiency & EHP',
    description: 'Deep efficiency tracking, collection log analytics, and EHP/EHB metric leaderboards.',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="#e5b352" stroke-width="2"><path d="M2 20h20M3 20V9l9-7 9 7v11M6 20v-8M10 20v-8M14 20v-8M18 20v-8"></path></svg>`
  },
  {
    id: 'osrs-portal',
    game: 'osrs',
    title: 'OSRS Portal Calculators',
    url: 'https://osrsportal.com/',
    category: 'Calculators',
    description: 'Specialized calculators for Raids (CoX/ToA), minigames, skilling methods, and boss loot.',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>`
  },
  {
    id: 'osrs-07gg',
    game: 'osrs',
    title: '07.gg Market Live',
    url: 'https://07.gg/',
    category: 'Market & Prices',
    description: 'Live trade visualizer, price alerts, and market trends for Old School items.',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>`
  },
  {
    id: 'osrs-reddit',
    game: 'osrs',
    title: 'r/2007scape Community',
    url: 'https://www.reddit.com/r/2007scape/',
    category: 'Community Hub',
    description: 'The primary OSRS subreddit for discussions, game updates, poll theorycrafting, and memes.',
    icon: `<svg viewBox="0 0 24 24" fill="#ff4500"><path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.56 12 8 12.56 8 13.25c0 .69.56 1.25 1.25 1.25.69 0 1.25-.56 1.25-1.25C10.5 12.56 9.94 12 9.25 12zm5.5 0c-.69 0-1.25.56-1.25 1.25 0 .69.56 1.25 1.25 1.25.69 0 1.25-.56 1.25-1.25 0-.69-.56-1.25-1.25-1.25zm-5.465 4.31a.488.488 0 0 0-.083.688c.618.79 1.637 1.252 2.798 1.252s2.18-.462 2.798-1.252a.489.489 0 0 0-.083-.688.49.49 0 0 0-.688.083c-.456.582-1.229.932-2.027.932-.798 0-1.571-.35-2.027-.932a.486.486 0 0 0-.688-.083z"/></svg>`
  },

  // =========================================================================
  // RuneScape: Dragonwilds
  // =========================================================================
  {
    id: 'dw-wiki',
    game: 'dragonwilds',
    title: 'Dragonwilds Official Wiki',
    url: 'https://dragonwilds.runescape.wiki/',
    category: 'Wiki & Guides',
    description: 'Official wiki for Ashenfall crafting recipes, resource nodes, Dragonkin Vaults, and survival mechanics.',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="#ff7b39" stroke-width="2"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path></svg>`
  },
  {
    id: 'dw-map',
    game: 'dragonwilds',
    title: 'Dragonwilds Interactive Map',
    url: 'https://mapgenie.io/runescape-dragonwilds',
    category: 'Interactive Map',
    description: 'MapGenie interactive map featuring lodestones, chests, resource veins, and lore artifacts.',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>`
  },
  {
    id: 'dw-steam',
    game: 'dragonwilds',
    title: 'Steam Community Hub',
    url: 'https://store.steampowered.com/app/1374490/RuneScape_Dragonwilds/',
    category: 'Official Hub',
    description: 'Official Steam discussions, patch notes (1.0.0.4+), player guides, and build showcases.',
    icon: `<svg viewBox="0 0 24 24" fill="#66c0f4"><path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.811c0 .052.005.105.005.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.733L.438 14.802C2.079 20.089 7.02 24 11.979 24c6.627 0 12.021-5.373 12.021-12S18.606 0 11.979 0z"/></svg>`
  },
  {
    id: 'dw-reddit',
    game: 'dragonwilds',
    title: 'r/RSDragonwilds Subreddit',
    url: 'https://www.reddit.com/r/RSDragonwilds/',
    category: 'Community Hub',
    description: 'Active player community for seed sharing, base building showcases, and survival tips.',
    icon: `<svg viewBox="0 0 24 24" fill="#ff4500"><path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.56 12 8 12.56 8 13.25c0 .69.56 1.25 1.25 1.25.69 0 1.25-.56 1.25-1.25C10.5 12.56 9.94 12 9.25 12zm5.5 0c-.69 0-1.25.56-1.25 1.25 0 .69.56 1.25 1.25 1.25.69 0 1.25-.56 1.25-1.25 0-.69-.56-1.25-1.25-1.25zm-5.465 4.31a.488.488 0 0 0-.083.688c.618.79 1.637 1.252 2.798 1.252s2.18-.462 2.798-1.252a.489.489 0 0 0-.083-.688.49.49 0 0 0-.688.083c-.456.582-1.229.932-2.027.932-.798 0-1.571-.35-2.027-.932a.486.486 0 0 0-.688-.083z"/></svg>`
  },
  {
    id: 'dw-discord',
    game: 'dragonwilds',
    title: 'Official Dragonwilds Discord',
    url: 'https://discord.gg/dragonwilds',
    category: 'Community & LFG',
    description: 'Co-op group matchmaking, trading, and direct feedback with the development team.',
    icon: `<svg viewBox="0 0 24 24" fill="#5865f2"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>`
  }
];
