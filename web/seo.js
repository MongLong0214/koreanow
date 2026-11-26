(() => {
  'use strict';
  const origin = 'https://koreanow.site';
  const regionSlugs = {
    Seoul: 'seoul', Busan: 'busan', Daegu: 'daegu', Incheon: 'incheon',
    Gwangju: 'gwangju', Daejeon: 'daejeon', Ulsan: 'ulsan', Sejong: 'sejong',
    Gyeonggi: 'gyeonggi', Gangwon: 'gangwon',
    'North Chungcheong': 'north-chungcheong', 'South Chungcheong': 'south-chungcheong',
    'North Jeolla': 'north-jeolla', 'South Jeolla': 'south-jeolla',
    'North Gyeongsang': 'north-gyeongsang', 'South Gyeongsang': 'south-gyeongsang', Jeju: 'jeju',
  };
  const regions = Object.freeze(Object.keys(regionSlugs));
  function regionPath(region) {
    if (region === 'all') return '/';
    if (!Object.hasOwn(regionSlugs, region)) throw new RangeError('Unknown camera region');
    return '/regions/' + regionSlugs[region] + '/';
  }
  function regionFromPath(pathname) {
    if (pathname === '/' || pathname === '/index.html') return 'all';
    const match = /^\/regions\/([a-z-]+)(?:\/|\/index\.html)?$/.exec(pathname);
    return match ? regions.find(region => regionSlugs[region] === match[1]) || null : null;
  }
  function page(cameras, region = 'all') {
    const path = regionPath(region);
    const url = origin + path;
    const selected = region === 'all' ? cameras : cameras.filter(camera => camera.region === region);
    const count = selected.length;
    const plural = count === 1 ? 'camera' : 'cameras';
    const examples = selected.slice(0, 2).map(camera => camera.name).join(count > 2 ? ', ' : ' and ');
    const title = region === 'all'
      ? 'Korea, now. — Live cameras across South Korea'
      : region + ' live ' + plural + ' (' + count + ') | Korea, now.';
    const description = region === 'all'
      ? 'Explore ' + count + ' live cameras across South Korea. Find cities, coastlines, and nature on an interactive map.'
      : 'Explore ' + count + ' public live ' + plural + ' in ' + region + ', South Korea. See ' + examples + (count > 2 ? ', and more' : '') + ' on the interactive map.';
    const heading = region === 'all' ? 'Live cameras across South Korea' : 'Live cameras in ' + region;
    const websiteId = origin + '/#website';
    const graph = [
      {'@type': 'WebSite', '@id': websiteId, url: origin + '/', name: 'Korea, now.', inLanguage: 'en'},
      {'@type': 'CollectionPage', '@id': url + '#webpage', url, name: title, description, inLanguage: 'en',
        isPartOf: {'@id': websiteId},
        about: region === 'all' ? {'@type': 'Country', name: 'South Korea'}
          : {'@type': 'AdministrativeArea', name: region, containedInPlace: {'@type': 'Country', name: 'South Korea'}},
        mainEntity: {'@type': 'ItemList', numberOfItems: count,
          itemListElement: selected.map((camera, index) => ({'@type': 'ListItem', position: index + 1,
            name: camera.name, url: camera.sourceUrl}))}},
    ];
    if (region !== 'all') graph.push({'@type': 'BreadcrumbList', '@id': url + '#breadcrumbs',
      itemListElement: [
        {'@type': 'ListItem', position: 1, name: 'Korea, now.', item: origin + '/'},
        {'@type': 'ListItem', position: 2, name: region, item: url},
      ]});
    return {path, url, title, description, heading, schema: {'@context': 'https://schema.org', '@graph': graph}};
  }
  window.KOREA_SEO = Object.freeze({origin, regions, regionPath, regionFromPath, page});
})();
