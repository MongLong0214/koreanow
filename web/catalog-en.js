/* English presentation layer for the 400 selected public cameras.
 * IDs, playback settings, URLs, coordinates, timestamps and original Korean
 * records remain unchanged in cameras.js and the preserved QA evidence.
 * English proper names are editorial romanizations, not a claim of official naming.
 */
(() => {
  'use strict';
  const regions = {
    "서울": "Seoul",
    "부산": "Busan",
    "대구": "Daegu",
    "인천": "Incheon",
    "광주": "Gwangju",
    "대전": "Daejeon",
    "울산": "Ulsan",
    "세종": "Sejong",
    "경기": "Gyeonggi",
    "강원": "Gangwon",
    "충북": "North Chungcheong",
    "충남": "South Chungcheong",
    "전북": "North Jeolla",
    "전남": "South Jeolla",
    "경북": "North Gyeongsang",
    "경남": "South Gyeongsang",
    "제주": "Jeju"
  };
  const providers = {
    "KBS 재난포털": "KBS Disaster Information Portal",
    "경기도교통정보센터 / 경기도교통정보센터-경기도": "Gyeonggi Traffic Information Center",
    "경기도교통정보센터 / 경찰청UTIS-안산시": "Gyeonggi Traffic Information Center / Ansan UTIS",
    "경기도교통정보센터 / 민자고속도로-제2영동고속도로": "Gyeonggi Traffic Information Center / Second Yeongdong Expressway",
    "경기도교통정보센터 / 서울시설공단": "Gyeonggi Traffic Information Center / Seoul Facilities Corporation",
    "경기도교통정보센터 / 한국도로공사": "Gyeonggi Traffic Information Center / Korea Expressway Corporation",
    "구미시 교통정보센터": "Gumi Traffic Information Center",
    "김포시 교통정보센터": "Gimpo Traffic Information Center",
    "당진시 교통정보센터": "Dangjin Traffic Information Center",
    "대구교통종합정보": "Daegu Traffic Information Center",
    "모나용평": "Mona Yongpyong",
    "부산광역시 교통정보서비스센터": "Busan Traffic Information Service Center",
    "부산광역시 교통정보서비스": "Busan Traffic Information Service Center",
    "세종특별자치시 교통정보시스템": "Sejong Traffic Information System",
    "여수시 교통정보센터": "Yeosu Traffic Information Center",
    "영산강홍수통제소": "Yeongsan River Flood Control Office",
    "웰리힐리파크": "Welli Hilli Park",
    "진주시 교통정보센터": "Jinju Traffic Information Center",
    "창원시 교통정보센터": "Changwon Traffic Information Center",
    "천안시 교통정보센터": "Cheonan Traffic Information Center",
    "청주통합교통정보센터": "Cheongju Traffic Information Center",
    "충주시 교통정보센터": "Chungju Traffic Information Center",
    "파주시 교통정보센터": "Paju Traffic Information Center"
  };
  const categoryLabels = {
    "city": "City",
    "sea": "Coast",
    "nature": "Nature"
  };
  const regionAliases = {
    "서울": "Seoul Special City",
    "부산": "Busan Metropolitan City Pusan",
    "대구": "Daegu Metropolitan City Taegu",
    "인천": "Incheon Metropolitan City Inchon",
    "광주": "Gwangju Metropolitan City Kwangju",
    "대전": "Daejeon Metropolitan City Taejon",
    "울산": "Ulsan Metropolitan City",
    "세종": "Sejong Special Self-Governing City",
    "경기": "Gyeonggi-do Gyeonggi Province Kyonggi",
    "강원": "Gangwon-do Gangwon Province Gangwon State Kangwon",
    "충북": "Chungbuk Chungcheongbuk-do North Chungcheong Province",
    "충남": "Chungnam Chungcheongnam-do South Chungcheong Province",
    "전북": "Jeonbuk Jeollabuk-do North Jeolla Province Jeonbuk State",
    "전남": "Jeonnam Jeollanam-do South Jeolla Province",
    "경북": "Gyeongbuk Gyeongsangbuk-do North Gyeongsang Province",
    "경남": "Gyeongnam Gyeongsangnam-do South Gyeongsang Province",
    "제주": "Jeju-do Jeju Island Jeju Special Self-Governing Province Cheju"
  };
  const cameras = {
    "kbs-109242": {
      "name": "Namsan Transmission Tower",
      "location": "Namsan, Seoul",
      "description": "A public camera view of Namsan Transmission Tower in Namsan, Seoul. Video provided by KBS Disaster Information Portal."
    },
    "kbs-9967": {
      "name": "Sebyeong Bridge · Oncheoncheon Stream",
      "location": "Dongnae, Busan",
      "description": "A public camera view of Sebyeong Bridge · Oncheoncheon Stream in Dongnae, Busan. Video provided by KBS Disaster Information Portal."
    },
    "kbs-9969": {
      "name": "Sincheon Stream",
      "location": "Dong-gu, Daegu",
      "description": "A public camera view of Sincheon Stream in Dong-gu, Daegu. Video provided by KBS Disaster Information Portal."
    },
    "kbs-9958": {
      "name": "Yeonpyeong Island",
      "location": "Ongjin, Incheon",
      "description": "A public camera view of Yeonpyeong Island in Ongjin, Incheon. Video provided by KBS Disaster Information Portal."
    },
    "yeongsan-110014": {
      "name": "Yongsan Bridge",
      "location": "Gwangju",
      "description": "A public camera view of Yongsan Bridge in Gwangju. Video provided by Yeongsan River Flood Control Office."
    },
    "kbs-9970": {
      "name": "Gapcheon River",
      "location": "Yuseong, Daejeon",
      "description": "A public camera view of Gapcheon River in Yuseong, Daejeon. Video provided by KBS Disaster Information Portal."
    },
    "kbs-9955": {
      "name": "KBS Ulsan",
      "location": "Dal-dong, Ulsan",
      "description": "A public camera view of KBS Ulsan in Dal-dong, Ulsan. Video provided by KBS Disaster Information Portal."
    },
    "sejong-cc1407003": {
      "name": "Government Complex Greenhouse · Above Underpass",
      "location": "Sejong",
      "description": "A public camera above the underpass behind the government complex greenhouse in Sejong. Video provided by Sejong Traffic Information System."
    },
    "kbs-9972": {
      "name": "Gapyeong Bridge No. 2 · Bukhangang River",
      "location": "Gapyeong, Gyeonggi",
      "description": "A public camera view of Gapyeong Bridge No. 2 · Bukhangang River in Gapyeong, Gyeonggi. Video provided by KBS Disaster Information Portal."
    },
    "kbs-9952": {
      "name": "KBS Gangneung",
      "location": "Gangneung, Gangwon",
      "description": "A public camera view of KBS Gangneung in Gangneung, Gangwon. Video provided by KBS Disaster Information Portal."
    },
    "kbs-9968": {
      "name": "Musimcheon Stream",
      "location": "Cheongju, North Chungcheong",
      "description": "A public camera view of Musimcheon Stream in Cheongju, North Chungcheong. Video provided by KBS Disaster Information Portal."
    },
    "kbs-9976": {
      "name": "Geumgang Bridge",
      "location": "Gongju, South Chungcheong",
      "description": "A public camera view of Geumgang Bridge in Gongju, South Chungcheong. Video provided by KBS Disaster Information Portal."
    },
    "kbs-9979": {
      "name": "Bieung Port",
      "location": "Gunsan, North Jeolla",
      "description": "A public camera view of Bieung Port in Gunsan, North Jeolla. Video provided by KBS Disaster Information Portal."
    },
    "kbs-9978": {
      "name": "Naju Bridge · Yeongsangang River",
      "location": "Naju, South Jeolla",
      "description": "A public camera view of Naju Bridge · Yeongsangang River in Naju, South Jeolla. Video provided by KBS Disaster Information Portal."
    },
    "kbs-9988": {
      "name": "Duho-dong Coast",
      "location": "Pohang, North Gyeongsang",
      "description": "A public camera view of Duho-dong Coast in Pohang, North Gyeongsang. Video provided by KBS Disaster Information Portal."
    },
    "kbs-9977": {
      "name": "Samnangjin · Nakdonggang River",
      "location": "Miryang, South Gyeongsang",
      "description": "A public camera view of Samnangjin · Nakdonggang River in Miryang, South Gyeongsang. Video provided by KBS Disaster Information Portal."
    },
    "kbs-9954": {
      "name": "KBS Jeju",
      "location": "Donam-dong, Jeju",
      "description": "A public camera view of KBS Jeju in Donam-dong, Jeju. Video provided by KBS Disaster Information Portal."
    },
    "kbs-9966": {
      "name": "Jungnangcheon Stream",
      "location": "Nowon, Seoul",
      "description": "A public camera view of Jungnangcheon Stream in Nowon, Seoul. Video provided by KBS Disaster Information Portal."
    },
    "kbs-9991": {
      "name": "Suyeong Bay",
      "location": "Millak Port, Busan",
      "description": "A public camera view of Suyeong Bay in Millak Port, Busan. Video provided by KBS Disaster Information Portal."
    },
    "daegu-04-101": {
      "name": "Dogok Intersection",
      "location": "Daegu",
      "description": "A public camera view of Dogok Intersection in Daegu. Video provided by Daegu Traffic Information Center."
    },
    "gimpo-cctv106": {
      "name": "Yuhyeon Intersection · Toward Geomdan",
      "location": "Geomdan, Incheon",
      "description": "A public camera view of Yuhyeon Intersection · Toward Geomdan in Geomdan, Incheon. Video provided by Gimpo Traffic Information Center."
    },
    "yeongsan-110016": {
      "name": "Yongjin Bridge",
      "location": "Gwangju",
      "description": "A public camera view of Yongjin Bridge in Gwangju. Video provided by Yeongsan River Flood Control Office."
    },
    "sejong-cc1415003": {
      "name": "Seongnam High School Intersection",
      "location": "Sejong",
      "description": "A public camera view of Seongnam High School Intersection in Sejong. Video provided by Sejong Traffic Information System."
    },
    "kbs-9956": {
      "name": "Gamaksan Mountain",
      "location": "Paju, Gyeonggi",
      "description": "A public camera view of Gamaksan Mountain in Paju, Gyeonggi. Video provided by KBS Disaster Information Portal."
    },
    "kbs-9986": {
      "name": "Sokcho Lighthouse Observatory",
      "location": "Sokcho, Gangwon",
      "description": "A public camera view of Sokcho Lighthouse Observatory in Sokcho, Gangwon. Video provided by KBS Disaster Information Portal."
    },
    "chungju-1": {
      "name": "Rotary No. 1",
      "location": "Chungju, North Chungcheong",
      "description": "A public camera view of Rotary No. 1 in Chungju, North Chungcheong. Video provided by Chungju Traffic Information Center."
    },
    "kbs-9980": {
      "name": "Sinjin Port",
      "location": "Taean, South Chungcheong",
      "description": "A public camera view of Sinjin Port in Taean, South Chungcheong. Video provided by KBS Disaster Information Portal."
    },
    "kbs-9971": {
      "name": "Baemsagol Valley · Jirisan",
      "location": "Namwon, North Jeolla",
      "description": "A public camera view of Baemsagol Valley · Jirisan in Namwon, North Jeolla. Video provided by KBS Disaster Information Portal."
    },
    "kbs-9992": {
      "name": "Mokpo North Port",
      "location": "Mokpo, South Jeolla",
      "description": "A public camera view of Mokpo North Port in Mokpo, South Jeolla. Video provided by KBS Disaster Information Portal."
    },
    "gumi-11": {
      "name": "Imsu Bridge Intersection",
      "location": "Gumi, North Gyeongsang",
      "description": "A public camera view of Imsu Bridge Intersection in Gumi, North Gyeongsang. Video provided by Gumi Traffic Information Center."
    },
    "changwon-10": {
      "name": "Changwon Sports Complex",
      "location": "Changwon, South Gyeongsang",
      "description": "A public camera view of Changwon Sports Complex in Changwon, South Gyeongsang. Video provided by Changwon Traffic Information Center."
    },
    "kbs-9982": {
      "name": "Marado Island",
      "location": "Seogwipo, Jeju",
      "description": "A public camera view of Marado Island in Seogwipo, Jeju. Video provided by KBS Disaster Information Portal."
    },
    "kbs-9965": {
      "name": "Seongsan Bridge · Hongjecheon Stream",
      "location": "Mapo, Seoul",
      "description": "A public camera view of Seongsan Bridge · Hongjecheon Stream in Mapo, Seoul. Video provided by KBS Disaster Information Portal."
    },
    "busan-ctv0000040": {
      "name": "Suyeong Intersection",
      "location": "Suyeong, Busan",
      "description": "A public camera view of Suyeong Intersection in Suyeong, Busan. Video provided by Busan Traffic Information Service Center."
    },
    "daegu-04-107": {
      "name": "South Daegu Interchange Junction",
      "location": "Daegu",
      "description": "A public camera view of South Daegu Interchange Junction in Daegu. Video provided by Daegu Traffic Information Center."
    },
    "yeongsan-110022": {
      "name": "Pungyeongjeongcheon Bridge No. 2",
      "location": "Gwangju",
      "description": "A public camera view of Pungyeongjeongcheon Bridge No. 2 in Gwangju. Video provided by Yeongsan River Flood Control Office."
    },
    "sejong-cc1424001": {
      "name": "Cheotmaeul Bypass · Above Underpass",
      "location": "Sejong",
      "description": "A public camera above the Cheotmaeul bypass underpass in Sejong. Video provided by Sejong Traffic Information System."
    },
    "gimpo-cctv001": {
      "name": "Gimpo Reco Park",
      "location": "Gimpo, Gyeonggi",
      "description": "A public camera view of Gimpo Reco Park in Gimpo, Gyeonggi. Video provided by Gimpo Traffic Information Center."
    },
    "yongpyong-08": {
      "name": "Yongpyong · Base Area & Red Slope",
      "location": "Pyeongchang, Gangwon",
      "description": "A public camera view of Yongpyong · Base Area & Red Slope in Pyeongchang, Gangwon. Video provided by Mona Yongpyong."
    },
    "chungju-12": {
      "name": "Chungju Interchange",
      "location": "Chungju, North Chungcheong",
      "description": "A public camera view of Chungju Interchange in Chungju, North Chungcheong. Video provided by Chungju Traffic Information Center."
    },
    "cheonan-6": {
      "name": "Bangjukan Five-way Junction",
      "location": "Cheonan, South Chungcheong",
      "description": "A public camera view of Bangjukan Five-way Junction in Cheonan, South Chungcheong. Video provided by Cheonan Traffic Information Center."
    },
    "kbs-9951": {
      "name": "KBS Jeonju",
      "location": "Jeonju, North Jeolla",
      "description": "A public camera view of KBS Jeonju in Jeonju, North Jeolla. Video provided by KBS Disaster Information Portal."
    },
    "kbs-9983": {
      "name": "Gageodo Island",
      "location": "Sinan, South Jeolla",
      "description": "A public camera view of Gageodo Island in Sinan, South Jeolla. Video provided by KBS Disaster Information Portal."
    },
    "gumi-12": {
      "name": "Siltron Plant 3 Intersection",
      "location": "Gumi, North Gyeongsang",
      "description": "A public camera view of Siltron Plant 3 Intersection in Gumi, North Gyeongsang. Video provided by Gumi Traffic Information Center."
    },
    "changwon-103": {
      "name": "Obongsa Temple Entrance",
      "location": "Changwon, South Gyeongsang",
      "description": "A public camera view of Obongsa Temple Entrance in Changwon, South Gyeongsang. Video provided by Changwon Traffic Information Center."
    },
    "yeongsan-13042": {
      "name": "Gaekkeurimin Bridge",
      "location": "Seogwipo, Jeju",
      "description": "A public camera view of Gaekkeurimin Bridge in Seogwipo, Jeju. Video provided by Yeongsan River Flood Control Office."
    },
    "kbs-9990": {
      "name": "Seocho-daero",
      "location": "Seocho, Seoul",
      "description": "A public camera view of Seocho-daero in Seocho, Seoul. Video provided by KBS Disaster Information Portal."
    },
    "busan-ctv0000053": {
      "name": "Suyeong Bridge No. 1 Intersection",
      "location": "Suyeong, Busan",
      "description": "A public camera view of Suyeong Bridge No. 1 Intersection in Suyeong, Busan. Video provided by Busan Traffic Information Service Center."
    },
    "daegu-04-109": {
      "name": "Keungogae Overpass",
      "location": "Daegu",
      "description": "A public camera view of Keungogae Overpass in Daegu. Video provided by Daegu Traffic Information Center."
    },
    "yeongsan-13003": {
      "name": "Geungnak Bridge",
      "location": "Gwangju",
      "description": "A public camera view of Geungnak Bridge in Gwangju. Video provided by Yeongsan River Flood Control Office."
    },
    "sejong-cc1424002": {
      "name": "Cheotmaeul Samsung Apartments",
      "location": "Sejong",
      "description": "A public camera view of Cheotmaeul Samsung Apartments in Sejong. Video provided by Sejong Traffic Information System."
    },
    "gimpo-cctv002": {
      "name": "Hosu Village Intersection",
      "location": "Gimpo, Gyeonggi",
      "description": "A public camera view of Hosu Village Intersection in Gimpo, Gyeonggi. Video provided by Gimpo Traffic Information Center."
    },
    "yongpyong-10": {
      "name": "Yongpyong · Pink Slope",
      "location": "Pyeongchang, Gangwon",
      "description": "A public camera view of Yongpyong · Pink Slope in Pyeongchang, Gangwon. Video provided by Mona Yongpyong."
    },
    "chungju-13": {
      "name": "Anlim Intersection · View 1",
      "location": "Chungju, North Chungcheong",
      "description": "A public camera view of Anlim Intersection · View 1 in Chungju, North Chungcheong. Video provided by Chungju Traffic Information Center."
    },
    "dangjin-6": {
      "name": "Seulhang Intersection",
      "location": "Dangjin, South Chungcheong",
      "description": "A public camera view of Seulhang Intersection in Dangjin, South Chungcheong. Video provided by Dangjin Traffic Information Center."
    },
    "yeongsan-110000": {
      "name": "Bujeong Bridge",
      "location": "Gochang, North Jeolla",
      "description": "A public camera view of Bujeong Bridge in Gochang, North Jeolla. Video provided by Yeongsan River Flood Control Office."
    },
    "kbs-9994": {
      "name": "Odongdo Island",
      "location": "Yeosu, South Jeolla",
      "description": "A public camera view of Odongdo Island in Yeosu, South Jeolla. Video provided by KBS Disaster Information Portal."
    },
    "gumi-15": {
      "name": "Hajang Bridge No. 2",
      "location": "Gumi, North Gyeongsang",
      "description": "A public camera view of Hajang Bridge No. 2 in Gumi, North Gyeongsang. Video provided by Gumi Traffic Information Center."
    },
    "changwon-106": {
      "name": "Wolseong Elementary School, Wanwol",
      "location": "Changwon, South Gyeongsang",
      "description": "A public camera view of Wolseong Elementary School, Wanwol in Changwon, South Gyeongsang. Video provided by Changwon Traffic Information Center."
    },
    "yeongsan-13044": {
      "name": "Gaerongi Bridge",
      "location": "Jeju City, Jeju",
      "description": "A public camera view of Gaerongi Bridge in Jeju City, Jeju. Video provided by Yeongsan River Flood Control Office."
    },
    "kbs-9973": {
      "name": "Yangjaecheon Stream",
      "location": "Seocho, Seoul",
      "description": "A public camera view of Yangjaecheon Stream in Seocho, Seoul. Video provided by KBS Disaster Information Portal."
    },
    "busan-ctv0000054": {
      "name": "Suyeong Bridge No. 2 · Millak Entrance",
      "location": "Suyeong, Busan",
      "description": "A public camera view of Suyeong Bridge No. 2 · Millak Entrance in Suyeong, Busan. Video provided by Busan Traffic Information Service Center."
    },
    "daegu-04-112": {
      "name": "Namchimsan Intersection",
      "location": "Daegu",
      "description": "A public camera view of Namchimsan Intersection in Daegu. Video provided by Daegu Traffic Information Center."
    },
    "yeongsan-13004": {
      "name": "Yuchon Bridge",
      "location": "Gwangju",
      "description": "A public camera view of Yuchon Bridge in Gwangju. Video provided by Yeongsan River Flood Control Office."
    },
    "sejong-cc1603001": {
      "name": "Onbit Elementary School Intersection",
      "location": "Sejong",
      "description": "A public camera view of Onbit Elementary School Intersection in Sejong. Video provided by Sejong Traffic Information System."
    },
    "gimpo-cctv003": {
      "name": "Gurae Station Intersection",
      "location": "Gimpo, Gyeonggi",
      "description": "A public camera view of Gurae Station Intersection in Gimpo, Gyeonggi. Video provided by Gimpo Traffic Information Center."
    },
    "yongpyong-11": {
      "name": "Yongpyong · Yellow Slope",
      "location": "Pyeongchang, Gangwon",
      "description": "A public camera view of Yongpyong · Yellow Slope in Pyeongchang, Gangwon. Video provided by Mona Yongpyong."
    },
    "chungju-14": {
      "name": "Anlim Intersection · View 2",
      "location": "Chungju, North Chungcheong",
      "description": "A public camera view of Anlim Intersection · View 2 in Chungju, North Chungcheong. Video provided by Chungju Traffic Information Center."
    },
    "dangjin-1": {
      "name": "Tapdong Intersection",
      "location": "Dangjin, South Chungcheong",
      "description": "A public camera view of Tapdong Intersection in Dangjin, South Chungcheong. Video provided by Dangjin Traffic Information Center."
    },
    "yeongsan-110002": {
      "name": "Senae Bridge",
      "location": "Jeonju, North Jeolla",
      "description": "A public camera view of Senae Bridge in Jeonju, North Jeolla. Video provided by Yeongsan River Flood Control Office."
    },
    "kbs-9984": {
      "name": "Wando Port",
      "location": "Wando, South Jeolla",
      "description": "A public camera view of Wando Port in Wando, South Jeolla. Video provided by KBS Disaster Information Portal."
    },
    "gumi-18": {
      "name": "Kumoh University Entrance · Geumo Bridge",
      "location": "Gumi, North Gyeongsang",
      "description": "A public camera view of Kumoh University Entrance · Geumo Bridge in Gumi, North Gyeongsang. Video provided by Gumi Traffic Information Center."
    },
    "changwon-108": {
      "name": "Osong Square Intersection",
      "location": "Changwon, South Gyeongsang",
      "description": "A public camera view of Osong Square Intersection in Changwon, South Gyeongsang. Video provided by Changwon Traffic Information Center."
    },
    "yeongsan-13046": {
      "name": "Dongsan Bridge No. 2",
      "location": "Jeju City, Jeju",
      "description": "A public camera view of Dongsan Bridge No. 2 in Jeju City, Jeju. Video provided by Yeongsan River Flood Control Office."
    },
    "kbs-9959": {
      "name": "Hangang River",
      "location": "Yongsan, Seoul",
      "description": "A public camera view of Hangang River in Yongsan, Seoul. Video provided by KBS Disaster Information Portal."
    },
    "busan-ctv0000070": {
      "name": "Daegyo Intersection",
      "location": "Yeongdo, Busan",
      "description": "A public camera view of Daegyo Intersection in Yeongdo, Busan. Video provided by Busan Traffic Information Service Center."
    },
    "daegu-04-133": {
      "name": "Yongsan Police Station",
      "location": "Daegu",
      "description": "A public camera view of Yongsan Police Station in Daegu. Video provided by Daegu Traffic Information Center."
    },
    "yeongsan-13050": {
      "name": "Byeokjin-dong",
      "location": "Gwangju",
      "description": "A public camera view of Byeokjin-dong in Gwangju. Video provided by Yeongsan River Flood Control Office."
    },
    "sejong-cc1603002": {
      "name": "Dareum Pass",
      "location": "Sejong",
      "description": "A public camera view of Dareum Pass in Sejong. Video provided by Sejong Traffic Information System."
    },
    "gimpo-cctv005": {
      "name": "Masan Station Intersection",
      "location": "Gimpo, Gyeonggi",
      "description": "A public camera view of Masan Station Intersection in Gimpo, Gyeonggi. Video provided by Gimpo Traffic Information Center."
    },
    "yongpyong-04": {
      "name": "Yongpyong · Mega Green Slope",
      "location": "Pyeongchang, Gangwon",
      "description": "A public camera view of Yongpyong · Mega Green Slope in Pyeongchang, Gangwon. Video provided by Mona Yongpyong."
    },
    "chungju-16": {
      "name": "Geumgok Intersection",
      "location": "Chungju, North Chungcheong",
      "description": "A public camera view of Geumgok Intersection in Chungju, North Chungcheong. Video provided by Chungju Traffic Information Center."
    },
    "dangjin-3": {
      "name": "Haengdong Intersection",
      "location": "Dangjin, South Chungcheong",
      "description": "A public camera view of Haengdong Intersection in Dangjin, South Chungcheong. Video provided by Dangjin Traffic Information Center."
    },
    "yeongsan-110004": {
      "name": "Soyang Bridge No. 2",
      "location": "Wanju, North Jeolla",
      "description": "A public camera view of Soyang Bridge No. 2 in Wanju, North Jeolla. Video provided by Yeongsan River Flood Control Office."
    },
    "yeongsan-110018": {
      "name": "Yonggang Bridge",
      "location": "Gwangyang, South Jeolla",
      "description": "A public camera view of Yonggang Bridge in Gwangyang, South Jeolla. Video provided by Yeongsan River Flood Control Office."
    },
    "gumi-24": {
      "name": "Indong Plaza Intersection",
      "location": "Gumi, North Gyeongsang",
      "description": "A public camera view of Indong Plaza Intersection in Gumi, North Gyeongsang. Video provided by Gumi Traffic Information Center."
    },
    "changwon-109": {
      "name": "Uian Intersection",
      "location": "Changwon, South Gyeongsang",
      "description": "A public camera view of Uian Intersection in Changwon, South Gyeongsang. Video provided by Changwon Traffic Information Center."
    },
    "yeongsan-13048": {
      "name": "Pyeonghwa Bridge",
      "location": "Seogwipo, Jeju",
      "description": "A public camera view of Pyeonghwa Bridge in Seogwipo, Jeju. Video provided by Yeongsan River Flood Control Office."
    },
    "kbs-9962": {
      "name": "Seoul Plaza",
      "location": "Jung-gu, Seoul",
      "description": "A public camera view of Seoul Plaza in Jung-gu, Seoul. Video provided by KBS Disaster Information Portal."
    },
    "busan-ctv0000085": {
      "name": "Haeundae District Office Junction",
      "location": "Haeundae, Busan",
      "description": "A public camera view of Haeundae District Office Junction in Haeundae, Busan. Video provided by Busan Traffic Information Service Center."
    },
    "daegu-04-135": {
      "name": "Duryu Park Intersection",
      "location": "Daegu",
      "description": "A public camera view of Duryu Park Intersection in Daegu. Video provided by Daegu Traffic Information Center."
    },
    "yeongsan-13074": {
      "name": "Sinun Bridge",
      "location": "Gwangju",
      "description": "A public camera view of Sinun Bridge in Gwangju. Video provided by Yeongsan River Flood Control Office."
    },
    "sejong-cc1603003": {
      "name": "Eunhasu Park · Rear Entrance",
      "location": "Sejong",
      "description": "A public camera view of Eunhasu Park · Rear Entrance in Sejong. Video provided by Sejong Traffic Information System."
    },
    "gimpo-cctv006": {
      "name": "Ungok Intersection",
      "location": "Gimpo, Gyeonggi",
      "description": "A public camera view of Ungok Intersection in Gimpo, Gyeonggi. Video provided by Gimpo Traffic Information Center."
    },
    "yongpyong-01": {
      "name": "Yongpyong · Balwangsan Skywalk",
      "location": "Pyeongchang, Gangwon",
      "description": "A public camera view of Yongpyong · Balwangsan Skywalk in Pyeongchang, Gangwon. Video provided by Mona Yongpyong."
    },
    "chungju-19": {
      "name": "Galdong Intersection",
      "location": "Chungju, North Chungcheong",
      "description": "A public camera view of Galdong Intersection in Chungju, North Chungcheong. Video provided by Chungju Traffic Information Center."
    },
    "yeongsan-110006": {
      "name": "Singi Bridge",
      "location": "Imsil, North Jeolla",
      "description": "A public camera view of Singi Bridge in Imsil, North Jeolla. Video provided by Yeongsan River Flood Control Office."
    },
    "yeongsan-110026": {
      "name": "Donggok-ri",
      "location": "Naju, South Jeolla",
      "description": "A public camera view of Donggok-ri in Naju, South Jeolla. Video provided by Yeongsan River Flood Control Office."
    },
    "gumi-25": {
      "name": "Saenggok-ri Pass, Seonsan",
      "location": "Gumi, North Gyeongsang",
      "description": "A public camera view of Saenggok-ri Pass, Seonsan in Gumi, North Gyeongsang. Video provided by Gumi Traffic Information Center."
    },
    "changwon-11": {
      "name": "Changgok Junction",
      "location": "Changwon, South Gyeongsang",
      "description": "A public camera view of Changgok Junction in Changwon, South Gyeongsang. Video provided by Changwon Traffic Information Center."
    },
    "gits-939": {
      "name": "Jungnang Bridge · East Side",
      "location": "Jungnang, Seoul",
      "description": "A public camera view of Jungnang Bridge · East Side in Jungnang, Seoul. Video provided by Gyeonggi Traffic Information Center / Seoul Facilities Corporation."
    },
    "busan-ctv0000087": {
      "name": "Dongbaek Intersection",
      "location": "Haeundae, Busan",
      "description": "A public camera view of Dongbaek Intersection in Haeundae, Busan. Video provided by Busan Traffic Information Service Center."
    },
    "daegu-04-143": {
      "name": "Geomdan Intersection",
      "location": "Daegu",
      "description": "A public camera view of Geomdan Intersection in Daegu. Video provided by Daegu Traffic Information Center."
    },
    "sejong-cc1608002": {
      "name": "Bangok Intersection",
      "location": "Sejong",
      "description": "A public camera view of Bangok Intersection in Sejong. Video provided by Sejong Traffic Information System."
    },
    "gimpo-cctv008": {
      "name": "Unyang Station Intersection",
      "location": "Gimpo, Gyeonggi",
      "description": "A public camera view of Unyang Station Intersection in Gimpo, Gyeonggi. Video provided by Gimpo Traffic Information Center."
    },
    "yongpyong-02": {
      "name": "Yongpyong · Balwangsan Yew Forest Trail",
      "location": "Pyeongchang, Gangwon",
      "description": "A public camera view of Yongpyong · Balwangsan Yew Forest Trail in Pyeongchang, Gangwon. Video provided by Mona Yongpyong."
    },
    "chungju-2": {
      "name": "Pungdong Interchange",
      "location": "Chungju, North Chungcheong",
      "description": "A public camera view of Pungdong Interchange in Chungju, North Chungcheong. Video provided by Chungju Traffic Information Center."
    },
    "yeongsan-110008": {
      "name": "Gangdong Bridge",
      "location": "Imsil, North Jeolla",
      "description": "A public camera view of Gangdong Bridge in Imsil, North Jeolla. Video provided by Yeongsan River Flood Control Office."
    },
    "yeongsan-110028": {
      "name": "Usan Bridge",
      "location": "Naju, South Jeolla",
      "description": "A public camera view of Usan Bridge in Naju, South Jeolla. Video provided by Yeongsan River Flood Control Office."
    },
    "gumi-26": {
      "name": "Gumi University",
      "location": "Gumi, North Gyeongsang",
      "description": "A public camera view of Gumi University in Gumi, North Gyeongsang. Video provided by Gumi Traffic Information Center."
    },
    "changwon-110": {
      "name": "Siseoljeondae Junction",
      "location": "Changwon, South Gyeongsang",
      "description": "A public camera view of Siseoljeondae Junction in Changwon, South Gyeongsang. Video provided by Changwon Traffic Information Center."
    },
    "busan-ctv0000098": {
      "name": "Gupo Bridge",
      "location": "Buk-gu, Busan",
      "description": "A public camera view of Gupo Bridge in Buk-gu, Busan. Video provided by Busan Traffic Information Service Center."
    },
    "daegu-04-144": {
      "name": "Suseong Market Intersection",
      "location": "Daegu",
      "description": "A public camera view of Suseong Market Intersection in Daegu. Video provided by Daegu Traffic Information Center."
    },
    "sejong-cc1609001": {
      "name": "e-Pyeonhansesang Intersection",
      "location": "Sejong",
      "description": "A public camera view of e-Pyeonhansesang Intersection in Sejong. Video provided by Sejong Traffic Information System."
    },
    "gimpo-cctv011": {
      "name": "Gochang Village Intersection",
      "location": "Gimpo, Gyeonggi",
      "description": "A public camera view of Gochang Village Intersection in Gimpo, Gyeonggi. Video provided by Gimpo Traffic Information Center."
    },
    "yongpyong-05": {
      "name": "Yongpyong · Resort Entrance",
      "location": "Pyeongchang, Gangwon",
      "description": "A public camera view of Yongpyong · Resort Entrance in Pyeongchang, Gangwon. Video provided by Mona Yongpyong."
    },
    "chungju-20": {
      "name": "Kingsdale Intersection",
      "location": "Chungju, North Chungcheong",
      "description": "A public camera view of Kingsdale Intersection in Chungju, North Chungcheong. Video provided by Chungju Traffic Information Center."
    },
    "yeongsan-110010": {
      "name": "Wolseok Bridge",
      "location": "Namwon, North Jeolla",
      "description": "A public camera view of Wolseok Bridge in Namwon, North Jeolla. Video provided by Yeongsan River Flood Control Office."
    },
    "yeongsan-110030": {
      "name": "Samji Bridge",
      "location": "Damyang, South Jeolla",
      "description": "A public camera view of Samji Bridge in Damyang, South Jeolla. Video provided by Yeongsan River Flood Control Office."
    },
    "gumi-27": {
      "name": "Bonggok Intersection",
      "location": "Gumi, North Gyeongsang",
      "description": "A public camera view of Bonggok Intersection in Gumi, North Gyeongsang. Video provided by Gumi Traffic Information Center."
    },
    "changwon-114": {
      "name": "Pyeongseong Intersection",
      "location": "Changwon, South Gyeongsang",
      "description": "A public camera view of Pyeongseong Intersection in Changwon, South Gyeongsang. Video provided by Changwon Traffic Information Center."
    },
    "busan-ctv0000102": {
      "name": "Eulsukdo Elementary School",
      "location": "Saha, Busan",
      "description": "A public camera view of Eulsukdo Elementary School in Saha, Busan. Video provided by Busan Traffic Information Service Center."
    },
    "daegu-04-16": {
      "name": "Dongdaegu Station Intersection",
      "location": "Daegu",
      "description": "A public camera view of Dongdaegu Station Intersection in Daegu. Video provided by Daegu Traffic Information Center."
    },
    "sejong-cc1609002": {
      "name": "Office of Education Junction",
      "location": "Sejong",
      "description": "A public camera view of Office of Education Junction in Sejong. Video provided by Sejong Traffic Information System."
    },
    "gimpo-cctv013": {
      "name": "Geumbit Waterway Bridge No. 1 Intersection",
      "location": "Gimpo, Gyeonggi",
      "description": "A public camera view of Geumbit Waterway Bridge No. 1 Intersection in Gimpo, Gyeonggi. Video provided by Gimpo Traffic Information Center."
    },
    "wellihilli-04": {
      "name": "Welli Hilli Park · Slopes & Plaza",
      "location": "Hoengseong, Gangwon",
      "description": "A public camera view of Welli Hilli Park · Slopes & Plaza in Hoengseong, Gangwon. Video provided by Welli Hilli Park."
    },
    "chungju-21": {
      "name": "POSCO Construction Intersection",
      "location": "Chungju, North Chungcheong",
      "description": "A public camera view of POSCO Construction Intersection in Chungju, North Chungcheong. Video provided by Chungju Traffic Information Center."
    },
    "yeongsan-110034": {
      "name": "Okcheon Bridge",
      "location": "Sunchang, North Jeolla",
      "description": "A public camera view of Okcheon Bridge in Sunchang, North Jeolla. Video provided by Yeongsan River Flood Control Office."
    },
    "yeongsan-110032": {
      "name": "Yangji Bridge",
      "location": "Damyang, South Jeolla",
      "description": "A public camera view of Yangji Bridge in Damyang, South Jeolla. Video provided by Yeongsan River Flood Control Office."
    },
    "gumi-3": {
      "name": "Goegok Intersection",
      "location": "Gumi, North Gyeongsang",
      "description": "A public camera view of Goegok Intersection in Gumi, North Gyeongsang. Video provided by Gumi Traffic Information Center."
    },
    "changwon-115": {
      "name": "Dongsin Apartments",
      "location": "Changwon, South Gyeongsang",
      "description": "A public camera view of Dongsin Apartments in Changwon, South Gyeongsang. Video provided by Changwon Traffic Information Center."
    },
    "busan-ctv0000105": {
      "name": "Dadaepo Beach Entrance",
      "location": "Saha, Busan",
      "description": "A public camera view of Dadaepo Beach Entrance in Saha, Busan. Video provided by Busan Traffic Information Service Center."
    },
    "daegu-04-177": {
      "name": "Hotel Suseong",
      "location": "Daegu",
      "description": "A public camera view of Hotel Suseong in Daegu. Video provided by Daegu Traffic Information Center."
    },
    "sejong-cc1614003": {
      "name": "Garak Village · Complex 8",
      "location": "Sejong",
      "description": "A public camera view of Garak Village · Complex 8 in Sejong. Video provided by Sejong Traffic Information System."
    },
    "gimpo-cctv014": {
      "name": "Cinepolis Interchange",
      "location": "Gimpo, Gyeonggi",
      "description": "A public camera view of Cinepolis Interchange in Gimpo, Gyeonggi. Video provided by Gimpo Traffic Information Center."
    },
    "wellihilli-07": {
      "name": "Welli Hilli Park · Water Planet",
      "location": "Hoengseong, Gangwon",
      "description": "A public camera view of Welli Hilli Park · Water Planet in Hoengseong, Gangwon. Video provided by Welli Hilli Park."
    },
    "chungju-22": {
      "name": "Lotte Brewery · Plant 1",
      "location": "Chungju, North Chungcheong",
      "description": "A public camera view of Lotte Brewery · Plant 1 in Chungju, North Chungcheong. Video provided by Chungju Traffic Information Center."
    },
    "yeongsan-110036": {
      "name": "Hyeonpo-ri",
      "location": "Sunchang, North Jeolla",
      "description": "A public camera view of Hyeonpo-ri in Sunchang, North Jeolla. Video provided by Yeongsan River Flood Control Office."
    },
    "yeongsan-110038": {
      "name": "Yeondong Bridge",
      "location": "Suncheon, South Jeolla",
      "description": "A public camera view of Yeondong Bridge in Suncheon, South Jeolla. Video provided by Yeongsan River Flood Control Office."
    },
    "gumi-31": {
      "name": "Wonpyeong Intersection · Bus Terminal",
      "location": "Gumi, North Gyeongsang",
      "description": "A public camera view of Wonpyeong Intersection · Bus Terminal in Gumi, North Gyeongsang. Video provided by Gumi Traffic Information Center."
    },
    "changwon-116": {
      "name": "Hanwha Techwin",
      "location": "Changwon, South Gyeongsang",
      "description": "A public camera view of Hanwha Techwin in Changwon, South Gyeongsang. Video provided by Changwon Traffic Information Center."
    },
    "busan-ctv0000117": {
      "name": "Airport Entrance",
      "location": "Gangseo, Busan",
      "description": "A public camera view of Airport Entrance in Gangseo, Busan. Video provided by Busan Traffic Information Service Center."
    },
    "daegu-04-28": {
      "name": "Paldal-ro",
      "location": "Daegu",
      "description": "A public camera view of Paldal-ro in Daegu. Video provided by Daegu Traffic Information Center."
    },
    "sejong-cc1901005": {
      "name": "Neobitteul Intersection",
      "location": "Sejong",
      "description": "A public camera view of Neobitteul Intersection in Sejong. Video provided by Sejong Traffic Information System."
    },
    "gimpo-cctv015": {
      "name": "Punggok Passage",
      "location": "Gimpo, Gyeonggi",
      "description": "A public camera view of Punggok Passage in Gimpo, Gyeonggi. Video provided by Gimpo Traffic Information Center."
    },
    "gits-5253": {
      "name": "West Wonju Interchange",
      "location": "Wonju, Gangwon",
      "description": "A public camera view of West Wonju Interchange in Wonju, Gangwon. Video provided by Gyeonggi Traffic Information Center / Second Yeongdong Expressway."
    },
    "chungju-23": {
      "name": "Enterprise City · Camera 4",
      "location": "Chungju, North Chungcheong",
      "description": "A public camera view of Enterprise City · Camera 4 in Chungju, North Chungcheong. Video provided by Chungju Traffic Information Center."
    },
    "yeongsan-110048": {
      "name": "Geosan Bridge",
      "location": "Jeongeup, North Jeolla",
      "description": "A public camera view of Geosan Bridge in Jeongeup, North Jeolla. Video provided by Yeongsan River Flood Control Office."
    },
    "yeongsan-110040": {
      "name": "Yongseo Bridge",
      "location": "Suncheon, South Jeolla",
      "description": "A public camera view of Yongseo Bridge in Suncheon, South Jeolla. Video provided by Yeongsan River Flood Control Office."
    },
    "gumi-32": {
      "name": "Gaksan Intersection, Wonpyeong-dong",
      "location": "Gumi, North Gyeongsang",
      "description": "A public camera view of Gaksan Intersection, Wonpyeong-dong in Gumi, North Gyeongsang. Video provided by Gumi Traffic Information Center."
    },
    "changwon-119": {
      "name": "Korea Expressway Corporation",
      "location": "Changwon, South Gyeongsang",
      "description": "A public camera view of Korea Expressway Corporation in Changwon, South Gyeongsang. Video provided by Changwon Traffic Information Center."
    },
    "busan-ctv0000125": {
      "name": "Jwasuyeong Bridge",
      "location": "Haeundae, Busan",
      "description": "A public camera view of Jwasuyeong Bridge in Haeundae, Busan. Video provided by Busan Traffic Information Service Center."
    },
    "daegu-04-98": {
      "name": "Sincheonji Intersection",
      "location": "Daegu",
      "description": "A public camera view of Sincheonji Intersection in Daegu. Video provided by Daegu Traffic Information Center."
    },
    "gimpo-cctv016": {
      "name": "Gojeong Intersection",
      "location": "Gimpo, Gyeonggi",
      "description": "A public camera view of Gojeong Intersection in Gimpo, Gyeonggi. Video provided by Gimpo Traffic Information Center."
    },
    "chungju-24": {
      "name": "Enterprise City · Camera 5",
      "location": "Chungju, North Chungcheong",
      "description": "A public camera view of Enterprise City · Camera 5 in Chungju, North Chungcheong. Video provided by Chungju Traffic Information Center."
    },
    "yeongsan-110050": {
      "name": "Jungnim Bridge",
      "location": "Jeongeup, North Jeolla",
      "description": "A public camera view of Jungnim Bridge in Jeongeup, North Jeolla. Video provided by Yeongsan River Flood Control Office."
    },
    "yeongsan-110044": {
      "name": "Gamcheon Bridge",
      "location": "Jangheung, South Jeolla",
      "description": "A public camera view of Gamcheon Bridge in Jangheung, South Jeolla. Video provided by Yeongsan River Flood Control Office."
    },
    "gumi-36": {
      "name": "Sinpyeong Gas Station · Toward Market",
      "location": "Gumi, North Gyeongsang",
      "description": "A public camera view of Sinpyeong Gas Station · Toward Market in Gumi, North Gyeongsang. Video provided by Gumi Traffic Information Center."
    },
    "changwon-140": {
      "name": "Ungcheon Elementary School, Nammun",
      "location": "Changwon, South Gyeongsang",
      "description": "A public camera view of Ungcheon Elementary School, Nammun in Changwon, South Gyeongsang. Video provided by Changwon Traffic Information Center."
    },
    "busan-ctv0000132": {
      "name": "Suyeong Bridge No. 4",
      "location": "Haeundae, Busan",
      "description": "A public camera view of Suyeong Bridge No. 4 in Haeundae, Busan. Video provided by Busan Traffic Information Service Center."
    },
    "daegu-05-1": {
      "name": "Imhyusa Temple · Daedeoksan",
      "location": "Daegu",
      "description": "A public camera view of Imhyusa Temple · Daedeoksan in Daegu. Video provided by Daegu Traffic Information Center."
    },
    "gimpo-cctv017": {
      "name": "Seongmo-ri Intersection",
      "location": "Gimpo, Gyeonggi",
      "description": "A public camera view of Seongmo-ri Intersection in Gimpo, Gyeonggi. Video provided by Gimpo Traffic Information Center."
    },
    "chungju-25": {
      "name": "Enterprise City · Camera 6",
      "location": "Chungju, North Chungcheong",
      "description": "A public camera view of Enterprise City · Camera 6 in Chungju, North Chungcheong. Video provided by Chungju Traffic Information Center."
    },
    "yeongsan-110067": {
      "name": "Jinbatdeul Bridge",
      "location": "Jeonju, North Jeolla",
      "description": "A public camera view of Jinbatdeul Bridge in Jeonju, North Jeolla. Video provided by Yeongsan River Flood Control Office."
    },
    "yeongsan-110046": {
      "name": "Byeolcheon Bridge",
      "location": "Jangheung, South Jeolla",
      "description": "A public camera view of Byeolcheon Bridge in Jangheung, South Jeolla. Video provided by Yeongsan River Flood Control Office."
    },
    "gumi-39": {
      "name": "Former Kumoh University Intersection",
      "location": "Gumi, North Gyeongsang",
      "description": "A public camera view of Former Kumoh University Intersection in Gumi, North Gyeongsang. Video provided by Gumi Traffic Information Center."
    },
    "changwon-142": {
      "name": "Seokdong Tunnel · Toward Changwon",
      "location": "Changwon, South Gyeongsang",
      "description": "A public camera view of Seokdong Tunnel · Toward Changwon in Changwon, South Gyeongsang. Video provided by Changwon Traffic Information Center."
    },
    "busan-ctv0000135": {
      "name": "Dadaepo Riverside Road",
      "location": "Saha, Busan",
      "description": "A public camera view of Dadaepo Riverside Road in Saha, Busan. Video provided by Busan Traffic Information Service Center."
    },
    "daegu-05-6": {
      "name": "Daedeok Cultural Center",
      "location": "Daegu",
      "description": "A public camera view of Daedeok Cultural Center in Daegu. Video provided by Daegu Traffic Information Center."
    },
    "gimpo-cctv018": {
      "name": "Daemyeong Port Junction · Choji Bridge",
      "location": "Gimpo, Gyeonggi",
      "description": "A public camera view of Daemyeong Port Junction · Choji Bridge in Gimpo, Gyeonggi. Video provided by Gimpo Traffic Information Center."
    },
    "chungju-28": {
      "name": "Sancheok Sorim",
      "location": "Chungju, North Chungcheong",
      "description": "A public camera view of Sancheok Sorim in Chungju, North Chungcheong. Video provided by Chungju Traffic Information Center."
    },
    "yeongsan-110069": {
      "name": "Gobucheon Bridge",
      "location": "Jeongeup, North Jeolla",
      "description": "A public camera view of Gobucheon Bridge in Jeongeup, North Jeolla. Video provided by Yeongsan River Flood Control Office."
    },
    "yeongsan-110054": {
      "name": "Wongomak Bridge",
      "location": "Hampyeong, South Jeolla",
      "description": "A public camera view of Wongomak Bridge in Hampyeong, South Jeolla. Video provided by Yeongsan River Flood Control Office."
    },
    "gumi-4": {
      "name": "Wonho Daewoo Apartments · North Side",
      "location": "Gumi, North Gyeongsang",
      "description": "A public camera view of Wonho Daewoo Apartments · North Side in Gumi, North Gyeongsang. Video provided by Gumi Traffic Information Center."
    },
    "changwon-155": {
      "name": "Ungdong Intersection",
      "location": "Changwon, South Gyeongsang",
      "description": "A public camera view of Ungdong Intersection in Changwon, South Gyeongsang. Video provided by Changwon Traffic Information Center."
    },
    "busan-ctv0000137": {
      "name": "Namhang Bridge · Seo-gu Entrance",
      "location": "Seo-gu, Busan",
      "description": "A public camera view of Namhang Bridge · Seo-gu Entrance in Seo-gu, Busan. Video provided by Busan Traffic Information Service Center."
    },
    "daegu-05-8": {
      "name": "Simsin Training Ground",
      "location": "Daegu",
      "description": "A public camera view of Simsin Training Ground in Daegu. Video provided by Daegu Traffic Information Center."
    },
    "gimpo-cctv093": {
      "name": "Daejeong Industries Junction",
      "location": "Gimpo, Gyeonggi",
      "description": "A public camera view of Daejeong Industries Junction in Gimpo, Gyeonggi. Video provided by Gimpo Traffic Information Center."
    },
    "chungju-29": {
      "name": "Judeok Five-way Junction",
      "location": "Chungju, North Chungcheong",
      "description": "A public camera view of Judeok Five-way Junction in Chungju, North Chungcheong. Video provided by Chungju Traffic Information Center."
    },
    "yeongsan-110071": {
      "name": "Wondong Bridge",
      "location": "Jeongeup, North Jeolla",
      "description": "A public camera view of Wondong Bridge in Jeongeup, North Jeolla. Video provided by Yeongsan River Flood Control Office."
    },
    "yeongsan-110056": {
      "name": "Hagya Bridge",
      "location": "Hampyeong, South Jeolla",
      "description": "A public camera view of Hagya Bridge in Hampyeong, South Jeolla. Video provided by Yeongsan River Flood Control Office."
    },
    "gumi-40": {
      "name": "Gwangpyeong Five-way Junction",
      "location": "Gumi, North Gyeongsang",
      "description": "A public camera view of Gwangpyeong Five-way Junction in Gumi, North Gyeongsang. Video provided by Gumi Traffic Information Center."
    },
    "changwon-20": {
      "name": "Eorin Bridge",
      "location": "Changwon, South Gyeongsang",
      "description": "A public camera view of Eorin Bridge in Changwon, South Gyeongsang. Video provided by Changwon Traffic Information Center."
    },
    "busan-ctv0000140": {
      "name": "Nulcha Bridge Entrance",
      "location": "Gangseo, Busan",
      "description": "A public camera view of Nulcha Bridge Entrance in Gangseo, Busan. Video provided by Busan Traffic Information Service Center."
    },
    "gimpo-cctv094": {
      "name": "Hakhyeoncheon Bridge No. 1 Intersection",
      "location": "Gimpo, Gyeonggi",
      "description": "A public camera view of Hakhyeoncheon Bridge No. 1 Intersection in Gimpo, Gyeonggi. Video provided by Gimpo Traffic Information Center."
    },
    "chungju-30": {
      "name": "Yongdu Intersection",
      "location": "Chungju, North Chungcheong",
      "description": "A public camera view of Yongdu Intersection in Chungju, North Chungcheong. Video provided by Chungju Traffic Information Center."
    },
    "yeongsan-110075": {
      "name": "Maryeong Bridge",
      "location": "Jinan, North Jeolla",
      "description": "A public camera view of Maryeong Bridge in Jinan, North Jeolla. Video provided by Yeongsan River Flood Control Office."
    },
    "yeongsan-110058": {
      "name": "Judo Bridge",
      "location": "Hwasun, South Jeolla",
      "description": "A public camera view of Judo Bridge in Hwasun, South Jeolla. Video provided by Yeongsan River Flood Control Office."
    },
    "gumi-42": {
      "name": "Otae-dong Car Dealerships",
      "location": "Gumi, North Gyeongsang",
      "description": "A public camera view of Otae-dong Car Dealerships in Gumi, North Gyeongsang. Video provided by Gumi Traffic Information Center."
    },
    "changwon-24": {
      "name": "Bongam Junction",
      "location": "Changwon, South Gyeongsang",
      "description": "A public camera view of Bongam Junction in Changwon, South Gyeongsang. Video provided by Changwon Traffic Information Center."
    },
    "busan-ctv0000141": {
      "name": "Children's Grand Park",
      "location": "Busanjin, Busan",
      "description": "A public camera view of Children's Grand Park in Busanjin, Busan. Video provided by Busan Traffic Information Service Center."
    },
    "gimpo-cctv095": {
      "name": "Daeseong C&C Intersection",
      "location": "Gimpo, Gyeonggi",
      "description": "A public camera view of Daeseong C&C Intersection in Gimpo, Gyeonggi. Video provided by Gimpo Traffic Information Center."
    },
    "chungju-31": {
      "name": "Imgwang Intersection · View 1",
      "location": "Chungju, North Chungcheong",
      "description": "A public camera view of Imgwang Intersection · View 1 in Chungju, North Chungcheong. Video provided by Chungju Traffic Information Center."
    },
    "yeongsan-110083": {
      "name": "Andeok Bridge",
      "location": "Jeonju, North Jeolla",
      "description": "A public camera view of Andeok Bridge in Jeonju, North Jeolla. Video provided by Yeongsan River Flood Control Office."
    },
    "yeongsan-110060": {
      "name": "Seosan Bridge",
      "location": "Gwangyang, South Jeolla",
      "description": "A public camera view of Seosan Bridge in Gwangyang, South Jeolla. Video provided by Yeongsan River Flood Control Office."
    },
    "gumi-43": {
      "name": "Industrial Complex Office · Toward Downtown",
      "location": "Gumi, North Gyeongsang",
      "description": "A public camera view of Industrial Complex Office · Toward Downtown in Gumi, North Gyeongsang. Video provided by Gumi Traffic Information Center."
    },
    "changwon-29": {
      "name": "Changwon Tunnel · Jangyu Side",
      "location": "Changwon, South Gyeongsang",
      "description": "A public camera view of Changwon Tunnel · Jangyu Side in Changwon, South Gyeongsang. Video provided by Changwon Traffic Information Center."
    },
    "busan-ctv0000162": {
      "name": "Gangbyeon-daero",
      "location": "Buk-gu, Busan",
      "description": "A public camera view of Gangbyeon-daero in Buk-gu, Busan. Video provided by Busan Traffic Information Service Center."
    },
    "gimpo-cctv097": {
      "name": "Singok Interchange · Toward Seoul",
      "location": "Gimpo, Gyeonggi",
      "description": "A public camera view of Singok Interchange · Toward Seoul in Gimpo, Gyeonggi. Video provided by Gimpo Traffic Information Center."
    },
    "chungju-33": {
      "name": "Tangeum Park Junction",
      "location": "Chungju, North Chungcheong",
      "description": "A public camera view of Tangeum Park Junction in Chungju, North Chungcheong. Video provided by Chungju Traffic Information Center."
    },
    "yeongsan-13006": {
      "name": "Yujeok Bridge",
      "location": "Sunchang, North Jeolla",
      "description": "A public camera view of Yujeok Bridge in Sunchang, North Jeolla. Video provided by Yeongsan River Flood Control Office."
    },
    "yeongsan-110063": {
      "name": "Yongdong Bridge",
      "location": "Jangseong, South Jeolla",
      "description": "A public camera view of Yongdong Bridge in Jangseong, South Jeolla. Video provided by Yeongsan River Flood Control Office."
    },
    "gumi-44": {
      "name": "Industrial Complex Office · Toward Indong",
      "location": "Gumi, North Gyeongsang",
      "description": "A public camera view of Industrial Complex Office · Toward Indong in Gumi, North Gyeongsang. Video provided by Gumi Traffic Information Center."
    },
    "changwon-3": {
      "name": "Samdong Intersection",
      "location": "Changwon, South Gyeongsang",
      "description": "A public camera view of Samdong Intersection in Changwon, South Gyeongsang. Video provided by Changwon Traffic Information Center."
    },
    "busan-ctv0000163": {
      "name": "Hwamyeong Bridge · Busan View",
      "location": "Buk-gu, Busan",
      "description": "A public camera view of Hwamyeong Bridge · Busan View in Buk-gu, Busan. Video provided by Busan Traffic Information Service Center."
    },
    "gimpo-cctv100": {
      "name": "Yongsan-dong Entrance · Toward Seoul",
      "location": "Gimpo, Gyeonggi",
      "description": "A public camera view of Yongsan-dong Entrance · Toward Seoul in Gimpo, Gyeonggi. Video provided by Gimpo Traffic Information Center."
    },
    "chungju-34": {
      "name": "Geumneung Intersection",
      "location": "Chungju, North Chungcheong",
      "description": "A public camera view of Geumneung Intersection in Chungju, North Chungcheong. Video provided by Chungju Traffic Information Center."
    },
    "yeongsan-13007": {
      "name": "Jeongu Bridge",
      "location": "Jeongeup, North Jeolla",
      "description": "A public camera view of Jeongu Bridge in Jeongeup, North Jeolla. Video provided by Yeongsan River Flood Control Office."
    },
    "yeongsan-110073": {
      "name": "Yeongsu Bridge",
      "location": "Hampyeong, South Jeolla",
      "description": "A public camera view of Yeongsu Bridge in Hampyeong, South Jeolla. Video provided by Yeongsan River Flood Control Office."
    },
    "gumi-46": {
      "name": "Cham Tech Intersection",
      "location": "Gumi, North Gyeongsang",
      "description": "A public camera view of Cham Tech Intersection in Gumi, North Gyeongsang. Video provided by Gumi Traffic Information Center."
    },
    "changwon-5": {
      "name": "Seongju Plaza",
      "location": "Changwon, South Gyeongsang",
      "description": "A public camera view of Seongju Plaza in Changwon, South Gyeongsang. Video provided by Changwon Traffic Information Center."
    },
    "busan-ctv0000164": {
      "name": "Hwamyeong Bridge · Gimhae View",
      "location": "Buk-gu, Busan",
      "description": "A public camera view of Hwamyeong Bridge · Gimhae View in Buk-gu, Busan. Video provided by Busan Traffic Information Service Center."
    },
    "gimpo-cctv101": {
      "name": "Daegot New Intersection · Toward Ganghwa",
      "location": "Gimpo, Gyeonggi",
      "description": "A public camera view of Daegot New Intersection · Toward Ganghwa in Gimpo, Gyeonggi. Video provided by Gimpo Traffic Information Center."
    },
    "chungju-36": {
      "name": "Yeonsu Elementary School Intersection",
      "location": "Chungju, North Chungcheong",
      "description": "A public camera view of Yeonsu Elementary School Intersection in Chungju, North Chungcheong. Video provided by Chungju Traffic Information Center."
    },
    "yeongsan-13012": {
      "name": "Dongnim Bridge",
      "location": "Namwon, North Jeolla",
      "description": "A public camera view of Dongnim Bridge in Namwon, North Jeolla. Video provided by Yeongsan River Flood Control Office."
    },
    "yeongsan-110079": {
      "name": "Neungju Bridge",
      "location": "Hwasun, South Jeolla",
      "description": "A public camera view of Neungju Bridge in Hwasun, South Jeolla. Video provided by Yeongsan River Flood Control Office."
    },
    "gumi-47": {
      "name": "Imsu-dong Electronics High School Junction",
      "location": "Gumi, North Gyeongsang",
      "description": "A public camera view of Imsu-dong Electronics High School Junction in Gumi, North Gyeongsang. Video provided by Gumi Traffic Information Center."
    },
    "changwon-51": {
      "name": "Kkachi Apartments Junction",
      "location": "Changwon, South Gyeongsang",
      "description": "A public camera view of Kkachi Apartments Junction in Changwon, South Gyeongsang. Video provided by Changwon Traffic Information Center."
    },
    "busan-ctv0000168": {
      "name": "Haeundae Cultural Center",
      "location": "Haeundae, Busan",
      "description": "A public camera view of Haeundae Cultural Center in Haeundae, Busan. Video provided by Busan Traffic Information Service Center."
    },
    "gimpo-cctv102": {
      "name": "Bongseong-ri Junction · Toward Seoul",
      "location": "Gimpo, Gyeonggi",
      "description": "A public camera view of Bongseong-ri Junction · Toward Seoul in Gimpo, Gyeonggi. Video provided by Gimpo Traffic Information Center."
    },
    "chungju-38": {
      "name": "Dongsin Apartments Junction",
      "location": "Chungju, North Chungcheong",
      "description": "A public camera view of Dongsin Apartments Junction in Chungju, North Chungcheong. Video provided by Chungju Traffic Information Center."
    },
    "yeongsan-13017": {
      "name": "Chogang-ri",
      "location": "Jeongeup, North Jeolla",
      "description": "A public camera view of Chogang-ri in Jeongeup, North Jeolla. Video provided by Yeongsan River Flood Control Office."
    },
    "yeongsan-110081": {
      "name": "Samcheon Bridge",
      "location": "Hwasun, South Jeolla",
      "description": "A public camera view of Samcheon Bridge in Hwasun, South Jeolla. Video provided by Yeongsan River Flood Control Office."
    },
    "gumi-48": {
      "name": "Soonchunhyang Intersection",
      "location": "Gumi, North Gyeongsang",
      "description": "A public camera view of Soonchunhyang Intersection in Gumi, North Gyeongsang. Video provided by Gumi Traffic Information Center."
    },
    "changwon-53": {
      "name": "Seobu Police Station Intersection",
      "location": "Changwon, South Gyeongsang",
      "description": "A public camera view of Seobu Police Station Intersection in Changwon, South Gyeongsang. Video provided by Changwon Traffic Information Center."
    },
    "busan-ctv0000169": {
      "name": "Gwangan Bridge · Upper Tower 2",
      "location": "Busan",
      "description": "A public camera view of Gwangan Bridge · Upper Tower 2 in Busan. Video provided by Busan Traffic Information Service Center."
    },
    "gimpo-cctv103": {
      "name": "Bukbyeon Interchange · Toward Hangang-ro",
      "location": "Gimpo, Gyeonggi",
      "description": "A public camera view of Bukbyeon Interchange · Toward Hangang-ro in Gimpo, Gyeonggi. Video provided by Gimpo Traffic Information Center."
    },
    "chungju-39": {
      "name": "Bonggye Intersection",
      "location": "Chungju, North Chungcheong",
      "description": "A public camera view of Bonggye Intersection in Chungju, North Chungcheong. Video provided by Chungju Traffic Information Center."
    },
    "yeongsan-13032": {
      "name": "Misan Bridge",
      "location": "Jeonju, North Jeolla",
      "description": "A public camera view of Misan Bridge in Jeonju, North Jeolla. Video provided by Yeongsan River Flood Control Office."
    },
    "yeongsan-13001": {
      "name": "Naju Bridge",
      "location": "Naju, South Jeolla",
      "description": "A public camera view of Naju Bridge in Naju, South Jeolla. Video provided by Yeongsan River Flood Control Office."
    },
    "gumi-49": {
      "name": "Road Traffic Authority · Toward Gupyeong",
      "location": "Gumi, North Gyeongsang",
      "description": "A public camera view of Road Traffic Authority · Toward Gupyeong in Gumi, North Gyeongsang. Video provided by Gumi Traffic Information Center."
    },
    "changwon-55": {
      "name": "Chasang Intersection",
      "location": "Changwon, South Gyeongsang",
      "description": "A public camera view of Chasang Intersection in Changwon, South Gyeongsang. Video provided by Changwon Traffic Information Center."
    },
    "busan-ctv0000170": {
      "name": "Gwangan Bridge · Upper Anchorage 2",
      "location": "Busan",
      "description": "A public camera view of Gwangan Bridge · Upper Anchorage 2 in Busan. Video provided by Busan Traffic Information Service Center."
    },
    "gimpo-cctv104": {
      "name": "Bukbyeon Interchange · Toward Ganghwa",
      "location": "Gimpo, Gyeonggi",
      "description": "A public camera view of Bukbyeon Interchange · Toward Ganghwa in Gimpo, Gyeonggi. Video provided by Gimpo Traffic Information Center."
    },
    "chungju-44": {
      "name": "Dongchon Intersection",
      "location": "Chungju, North Chungcheong",
      "description": "A public camera view of Dongchon Intersection in Chungju, North Chungcheong. Video provided by Chungju Traffic Information Center."
    },
    "yeongsan-13034": {
      "name": "Yongbong Bridge",
      "location": "Wanju, North Jeolla",
      "description": "A public camera view of Yongbong Bridge in Wanju, North Jeolla. Video provided by Yeongsan River Flood Control Office."
    },
    "yeongsan-13008": {
      "name": "Gurye Bridge",
      "location": "Gurye, South Jeolla",
      "description": "A public camera view of Gurye Bridge in Gurye, South Jeolla. Video provided by Yeongsan River Flood Control Office."
    },
    "gumi-51": {
      "name": "Gupyeong Yeongmu Yedaeum Intersection",
      "location": "Gumi, North Gyeongsang",
      "description": "A public camera view of Gupyeong Yeongmu Yedaeum Intersection in Gumi, North Gyeongsang. Video provided by Gumi Traffic Information Center."
    },
    "changwon-56": {
      "name": "Courthouse Intersection",
      "location": "Changwon, South Gyeongsang",
      "description": "A public camera view of Courthouse Intersection in Changwon, South Gyeongsang. Video provided by Changwon Traffic Information Center."
    },
    "busan-ctv0000180": {
      "name": "Gwangan Bridge · Yongdang Merge",
      "location": "Busan",
      "description": "A public camera view of Gwangan Bridge · Yongdang Merge in Busan. Video provided by Busan Traffic Information Service Center."
    },
    "gimpo-cctv105": {
      "name": "Yuhyeon Intersection · Toward Incheon",
      "location": "Gimpo, Gyeonggi",
      "description": "A public camera view of Yuhyeon Intersection · Toward Incheon in Gimpo, Gyeonggi. Video provided by Gimpo Traffic Information Center."
    },
    "chungju-45": {
      "name": "Enterprise City · Camera 7",
      "location": "Chungju, North Chungcheong",
      "description": "A public camera view of Enterprise City · Camera 7 in Chungju, North Chungcheong. Video provided by Chungju Traffic Information Center."
    },
    "yeongsan-13036": {
      "name": "Samnye Bridge",
      "location": "Wanju, North Jeolla",
      "description": "A public camera view of Samnye Bridge in Wanju, North Jeolla. Video provided by Yeongsan River Flood Control Office."
    },
    "yeongsan-13010": {
      "name": "Songjeong-ri",
      "location": "Gurye, South Jeolla",
      "description": "A public camera view of Songjeong-ri in Gurye, South Jeolla. Video provided by Yeongsan River Flood Control Office."
    },
    "gumi-52": {
      "name": "South Gumi Bridge Intersection",
      "location": "Gumi, North Gyeongsang",
      "description": "A public camera view of South Gumi Bridge Intersection in Gumi, North Gyeongsang. Video provided by Gumi Traffic Information Center."
    },
    "changwon-57": {
      "name": "Toechon Intersection",
      "location": "Changwon, South Gyeongsang",
      "description": "A public camera view of Toechon Intersection in Changwon, South Gyeongsang. Video provided by Changwon Traffic Information Center."
    },
    "busan-ctv0000207": {
      "name": "Eulsukdo Bridge · Saha View",
      "location": "Saha, Busan",
      "description": "A public camera view of Eulsukdo Bridge · Saha View in Saha, Busan. Video provided by Busan Traffic Information Service Center."
    },
    "gimpo-cctv107": {
      "name": "Hakhyeoncheon Bridge No. 1 · Toward Ganghwa",
      "location": "Gimpo, Gyeonggi",
      "description": "A public camera view of Hakhyeoncheon Bridge No. 1 · Toward Ganghwa in Gimpo, Gyeonggi. Video provided by Gimpo Traffic Information Center."
    },
    "chungju-46": {
      "name": "Yuhan-Kimberly Intersection",
      "location": "Chungju, North Chungcheong",
      "description": "A public camera view of Yuhan-Kimberly Intersection in Chungju, North Chungcheong. Video provided by Chungju Traffic Information Center."
    },
    "yeongsan-13038": {
      "name": "Iljung-ri",
      "location": "Imsil, North Jeolla",
      "description": "A public camera view of Iljung-ri in Imsil, North Jeolla. Video provided by Yeongsan River Flood Control Office."
    },
    "yeongsan-13014": {
      "name": "Hwangnyong Bridge No. 2",
      "location": "Jangseong, South Jeolla",
      "description": "A public camera view of Hwangnyong Bridge No. 2 in Jangseong, South Jeolla. Video provided by Yeongsan River Flood Control Office."
    },
    "gumi-54": {
      "name": "Seonsan Bus Terminal Intersection",
      "location": "Gumi, North Gyeongsang",
      "description": "A public camera view of Seonsan Bus Terminal Intersection in Gumi, North Gyeongsang. Video provided by Gumi Traffic Information Center."
    },
    "changwon-61": {
      "name": "Paryong Jukjeon Intersection",
      "location": "Changwon, South Gyeongsang",
      "description": "A public camera view of Paryong Jukjeon Intersection in Changwon, South Gyeongsang. Video provided by Changwon Traffic Information Center."
    },
    "busan-ctv0000212": {
      "name": "Nakdong Bridge No. 2 · Gangseo View",
      "location": "Gangseo, Busan",
      "description": "A public camera view of Nakdong Bridge No. 2 · Gangseo View in Gangseo, Busan. Video provided by Busan Traffic Information Service Center."
    },
    "gits-1256": {
      "name": "Daeseong Intersection",
      "location": "Gapyeong, Gyeonggi",
      "description": "A public camera view of Daeseong Intersection in Gapyeong, Gyeonggi. Video provided by Gyeonggi Traffic Information Center."
    },
    "chungju-47": {
      "name": "Koiz Intersection",
      "location": "Chungju, North Chungcheong",
      "description": "A public camera view of Koiz Intersection in Chungju, North Chungcheong. Video provided by Chungju Traffic Information Center."
    },
    "yeongsan-13040": {
      "name": "Seocheon Bridge",
      "location": "Jeonju, North Jeolla",
      "description": "A public camera view of Seocheon Bridge in Jeonju, North Jeolla. Video provided by Yeongsan River Flood Control Office."
    },
    "yeongsan-13027": {
      "name": "Taean Bridge",
      "location": "Gokseong, South Jeolla",
      "description": "A public camera view of Taean Bridge in Gokseong, South Jeolla. Video provided by Yeongsan River Flood Control Office."
    },
    "gumi-55": {
      "name": "Chamber of Commerce Intersection",
      "location": "Gumi, North Gyeongsang",
      "description": "A public camera view of Chamber of Commerce Intersection in Gumi, North Gyeongsang. Video provided by Gumi Traffic Information Center."
    },
    "changwon-62": {
      "name": "Gaeumjeong Intersection",
      "location": "Changwon, South Gyeongsang",
      "description": "A public camera view of Gaeumjeong Intersection in Changwon, South Gyeongsang. Video provided by Changwon Traffic Information Center."
    },
    "busan-ctv0000233": {
      "name": "Eulsukdo Bridge · Camera 5",
      "location": "Busan",
      "description": "A public camera view of Eulsukdo Bridge · Camera 5 in Busan. Video provided by Busan Traffic Information Service Center."
    },
    "gits-1675": {
      "name": "Hwaak Tunnel · View 2",
      "location": "Gyeonggi",
      "description": "A public camera view of Hwaak Tunnel · View 2 in Gyeonggi. Video provided by Gyeonggi Traffic Information Center."
    },
    "chungju-48": {
      "name": "Imgwang Intersection · View 2",
      "location": "Chungju, North Chungcheong",
      "description": "A public camera view of Imgwang Intersection · View 2 in Chungju, North Chungcheong. Video provided by Chungju Traffic Information Center."
    },
    "yeongsan-13060": {
      "name": "Yocheon Bridge",
      "location": "Namwon, North Jeolla",
      "description": "A public camera view of Yocheon Bridge in Namwon, North Jeolla. Video provided by Yeongsan River Flood Control Office."
    },
    "yeongsan-13054": {
      "name": "Hapgang Bridge",
      "location": "Gokseong, South Jeolla",
      "description": "A public camera view of Hapgang Bridge in Gokseong, South Jeolla. Video provided by Yeongsan River Flood Control Office."
    },
    "gumi-59": {
      "name": "Kolon Intersection",
      "location": "Gumi, North Gyeongsang",
      "description": "A public camera view of Kolon Intersection in Gumi, North Gyeongsang. Video provided by Gumi Traffic Information Center."
    },
    "changwon-7": {
      "name": "Myeonggok Plaza",
      "location": "Changwon, South Gyeongsang",
      "description": "A public camera view of Myeonggok Plaza in Changwon, South Gyeongsang. Video provided by Changwon Traffic Information Center."
    },
    "busan-ctv0000257": {
      "name": "Songjeong Junction",
      "location": "Haeundae, Busan",
      "description": "A public camera view of Songjeong Junction in Haeundae, Busan. Video provided by Busan Traffic Information Service Center."
    },
    "gits-186": {
      "name": "Songsan Intersection",
      "location": "Gyeonggi",
      "description": "A public camera view of Songsan Intersection in Gyeonggi. Video provided by Gyeonggi Traffic Information Center."
    },
    "chungju-52": {
      "name": "Wonhoam Five-way Junction",
      "location": "Chungju, North Chungcheong",
      "description": "A public camera view of Wonhoam Five-way Junction in Chungju, North Chungcheong. Video provided by Chungju Traffic Information Center."
    },
    "yeongsan-13070": {
      "name": "Mudeung Bridge No. 1",
      "location": "Imsil, North Jeolla",
      "description": "A public camera view of Mudeung Bridge No. 1 in Imsil, North Jeolla. Video provided by Yeongsan River Flood Control Office."
    },
    "yeongsan-13056": {
      "name": "Mumyeong Bridge",
      "location": "Naju, South Jeolla",
      "description": "A public camera view of Mumyeong Bridge in Naju, South Jeolla. Video provided by Yeongsan River Flood Control Office."
    },
    "gumi-6": {
      "name": "Jisang Pneumatic Intersection",
      "location": "Gumi, North Gyeongsang",
      "description": "A public camera view of Jisang Pneumatic Intersection in Gumi, North Gyeongsang. Video provided by Gumi Traffic Information Center."
    },
    "changwon-72": {
      "name": "Wollim Junction",
      "location": "Changwon, South Gyeongsang",
      "description": "A public camera view of Wollim Junction in Changwon, South Gyeongsang. Video provided by Changwon Traffic Information Center."
    },
    "busan-ctv0000258": {
      "name": "Songjeong Bridge No. 1",
      "location": "Gijang, Busan",
      "description": "A public camera view of Songjeong Bridge No. 1 in Gijang, Busan. Video provided by Busan Traffic Information Service Center."
    },
    "gits-5239": {
      "name": "Heungcheon-Ipo Interchange",
      "location": "Gyeonggi",
      "description": "A public camera view of Heungcheon-Ipo Interchange in Gyeonggi. Video provided by Gyeonggi Traffic Information Center / Second Yeongdong Expressway."
    },
    "chungju-53": {
      "name": "Hamji Intersection",
      "location": "Chungju, North Chungcheong",
      "description": "A public camera view of Hamji Intersection in Chungju, North Chungcheong. Video provided by Chungju Traffic Information Center."
    },
    "yeongsan-13062": {
      "name": "Mongtan Bridge",
      "location": "Muan, South Jeolla",
      "description": "A public camera view of Mongtan Bridge in Muan, South Jeolla. Video provided by Yeongsan River Flood Control Office."
    },
    "gumi-60": {
      "name": "Tax Office Intersection",
      "location": "Gumi, North Gyeongsang",
      "description": "A public camera view of Tax Office Intersection in Gumi, North Gyeongsang. Video provided by Gumi Traffic Information Center."
    },
    "changwon-78": {
      "name": "Export Zone Main Gate Intersection",
      "location": "Changwon, South Gyeongsang",
      "description": "A public camera view of Export Zone Main Gate Intersection in Changwon, South Gyeongsang. Video provided by Changwon Traffic Information Center."
    },
    "busan-ctv0000300": {
      "name": "Songjeong Intersection",
      "location": "Gangseo, Busan",
      "description": "A public camera view of Songjeong Intersection in Gangseo, Busan. Video provided by Busan Traffic Information Service Center."
    },
    "gits-547": {
      "name": "Sangsin Bridge No. 2",
      "location": "Gyeonggi",
      "description": "A public camera view of Sangsin Bridge No. 2 in Gyeonggi. Video provided by Gyeonggi Traffic Information Center / Korea Expressway Corporation."
    },
    "chungju-54": {
      "name": "I-Park Main Road",
      "location": "Chungju, North Chungcheong",
      "description": "A public camera view of I-Park Main Road in Chungju, North Chungcheong. Video provided by Chungju Traffic Information Center."
    },
    "yeongsan-13064": {
      "name": "Goemok Bridge No. 3",
      "location": "Suncheon, South Jeolla",
      "description": "A public camera view of Goemok Bridge No. 3 in Suncheon, South Jeolla. Video provided by Yeongsan River Flood Control Office."
    },
    "gumi-61": {
      "name": "Okgye Underpass Intersection",
      "location": "Gumi, North Gyeongsang",
      "description": "A public camera view of Okgye Underpass Intersection in Gumi, North Gyeongsang. Video provided by Gumi Traffic Information Center."
    },
    "changwon-87": {
      "name": "Gyeongnam Apartments, Yangdeok-dong",
      "location": "Changwon, South Gyeongsang",
      "description": "A public camera view of Gyeongnam Apartments, Yangdeok-dong in Changwon, South Gyeongsang. Video provided by Changwon Traffic Information Center."
    },
    "busan-ctv0000302": {
      "name": "Geoga Bridge Approach",
      "location": "Gangseo, Busan",
      "description": "A public camera view of Geoga Bridge Approach in Gangseo, Busan. Video provided by Busan Traffic Information Service Center."
    },
    "gits-6958": {
      "name": "Bangameori",
      "location": "Ansan, Gyeonggi",
      "description": "A public camera view of Bangameori in Ansan, Gyeonggi. Video provided by Gyeonggi Traffic Information Center / Ansan UTIS."
    },
    "chungju-56": {
      "name": "GNP Junction",
      "location": "Chungju, North Chungcheong",
      "description": "A public camera view of GNP Junction in Chungju, North Chungcheong. Video provided by Chungju Traffic Information Center."
    },
    "yeongsan-13068": {
      "name": "Banwa Bridge",
      "location": "Yeonggwang, South Jeolla",
      "description": "A public camera view of Banwa Bridge in Yeonggwang, South Jeolla. Video provided by Yeongsan River Flood Control Office."
    },
    "gumi-62": {
      "name": "Indong Intersection",
      "location": "Gumi, North Gyeongsang",
      "description": "A public camera view of Indong Intersection in Gumi, North Gyeongsang. Video provided by Gumi Traffic Information Center."
    },
    "changwon-9": {
      "name": "Sinchon Plaza",
      "location": "Changwon, South Gyeongsang",
      "description": "A public camera view of Sinchon Plaza in Changwon, South Gyeongsang. Video provided by Changwon Traffic Information Center."
    },
    "busan-ctv0000403": {
      "name": "Haeundae Eastern Prosecutors' Office",
      "location": "Haeundae, Busan",
      "description": "A public camera view of Haeundae Eastern Prosecutors' Office in Haeundae, Busan. Video provided by Busan Traffic Information Service Center."
    },
    "paju-35": {
      "name": "Geomsan Junction",
      "location": "Paju, Gyeonggi",
      "description": "A public camera view of Geomsan Junction in Paju, Gyeonggi. Video provided by Paju Traffic Information Center."
    },
    "chungju-57": {
      "name": "Samwon Gas Station",
      "location": "Chungju, North Chungcheong",
      "description": "A public camera view of Samwon Gas Station in Chungju, North Chungcheong. Video provided by Chungju Traffic Information Center."
    },
    "yeosu-4": {
      "name": "Sora 119 Fire Station",
      "location": "Yeosu, South Jeolla",
      "description": "A public camera view of Sora 119 Fire Station in Yeosu, South Jeolla. Video provided by Yeosu Traffic Information Center."
    },
    "gumi-64": {
      "name": "Jungang Market Intersection",
      "location": "Gumi, North Gyeongsang",
      "description": "A public camera view of Jungang Market Intersection in Gumi, North Gyeongsang. Video provided by Gumi Traffic Information Center."
    },
    "jinju-1000001200": {
      "name": "Gaeyang Five-way Junction · Toward Route 2",
      "location": "Jinju, South Gyeongsang",
      "description": "A public camera view of Gaeyang Five-way Junction · Toward Route 2 in Jinju, South Gyeongsang. Video provided by Jinju Traffic Information Center."
    },
    "busan-ctv0000406": {
      "name": "Ireumnan Amso Galbi, Haeundae",
      "location": "Haeundae, Busan",
      "description": "A public camera view of Ireumnan Amso Galbi, Haeundae in Haeundae, Busan. Video provided by Busan Traffic Information Service Center."
    },
    "paju-81": {
      "name": "Gwangtan Bridge No. 1 Intersection",
      "location": "Paju, Gyeonggi",
      "description": "A public camera view of Gwangtan Bridge No. 1 Intersection in Paju, Gyeonggi. Video provided by Paju Traffic Information Center."
    },
    "chungju-58": {
      "name": "Ruam Intersection",
      "location": "Chungju, North Chungcheong",
      "description": "A public camera view of Ruam Intersection in Chungju, North Chungcheong. Video provided by Chungju Traffic Information Center."
    },
    "yeosu-56": {
      "name": "Hwayang Bridge",
      "location": "Yeosu, South Jeolla",
      "description": "A public camera view of Hwayang Bridge in Yeosu, South Jeolla. Video provided by Yeosu Traffic Information Center."
    },
    "gumi-65": {
      "name": "Hwangsang-dong Entrance Junction",
      "location": "Gumi, North Gyeongsang",
      "description": "A public camera view of Hwangsang-dong Entrance Junction in Gumi, North Gyeongsang. Video provided by Gumi Traffic Information Center."
    },
    "jinju-1000001202": {
      "name": "Gaeyang Five-way Junction · Toward Police Station",
      "location": "Jinju, South Gyeongsang",
      "description": "A public camera view of Gaeyang Five-way Junction · Toward Police Station in Jinju, South Gyeongsang. Video provided by Jinju Traffic Information Center."
    },
    "busan-ctv0000495": {
      "name": "Sinseondae · Gwangan Entrance",
      "location": "Nam-gu, Busan",
      "description": "A public camera view of Sinseondae · Gwangan Entrance in Nam-gu, Busan. Video provided by Busan Traffic Information Service Center."
    },
    "paju-7": {
      "name": "Geumchon Station Intersection",
      "location": "Paju, Gyeonggi",
      "description": "A public camera view of Geumchon Station Intersection in Paju, Gyeonggi. Video provided by Paju Traffic Information Center."
    },
    "chungju-7": {
      "name": "Sinyeonsu Intersection",
      "location": "Chungju, North Chungcheong",
      "description": "A public camera view of Sinyeonsu Intersection in Chungju, North Chungcheong. Video provided by Chungju Traffic Information Center."
    },
    "gumi-71": {
      "name": "Otae Junction",
      "location": "Gumi, North Gyeongsang",
      "description": "A public camera view of Otae Junction in Gumi, North Gyeongsang. Video provided by Gumi Traffic Information Center."
    },
    "jinju-1000001203": {
      "name": "Gaeyang Five-way Junction · Toward Seongnyu Park",
      "location": "Jinju, South Gyeongsang",
      "description": "A public camera view of Gaeyang Five-way Junction · Toward Seongnyu Park in Jinju, South Gyeongsang. Video provided by Jinju Traffic Information Center."
    },
    "busan-ctv0000003": {
      "name": "Old City Hall",
      "location": "Jung-gu, Busan",
      "description": "A public camera view of Old City Hall in Jung-gu, Busan. Video provided by Busan Traffic Information Service Center."
    },
    "paju-80": {
      "name": "Deogeun Intersection No. 2",
      "location": "Paju, Gyeonggi",
      "description": "A public camera view of Deogeun Intersection No. 2 in Paju, Gyeonggi. Video provided by Paju Traffic Information Center."
    },
    "chungju-9": {
      "name": "Gonggun 3 Junction",
      "location": "Chungju, North Chungcheong",
      "description": "A public camera view of Gonggun 3 Junction in Chungju, North Chungcheong. Video provided by Chungju Traffic Information Center."
    },
    "gumi-74": {
      "name": "Sagok Five-way Junction",
      "location": "Gumi, North Gyeongsang",
      "description": "A public camera view of Sagok Five-way Junction in Gumi, North Gyeongsang. Video provided by Gumi Traffic Information Center."
    },
    "jinju-1000001204": {
      "name": "Gaeyang Five-way Junction · Toward Jeongchon School",
      "location": "Jinju, South Gyeongsang",
      "description": "A public camera view of Gaeyang Five-way Junction · Toward Jeongchon School in Jinju, South Gyeongsang. Video provided by Jinju Traffic Information Center."
    },
    "busan-ctv0000006": {
      "name": "Busan Station",
      "location": "Dong-gu, Busan",
      "description": "A public camera view of Busan Station in Dong-gu, Busan. Video provided by Busan Traffic Information Service Center."
    },
    "paju-31": {
      "name": "Deogeun Intersection",
      "location": "Paju, Gyeonggi",
      "description": "A public camera view of Deogeun Intersection in Paju, Gyeonggi. Video provided by Paju Traffic Information Center."
    },
    "cheongju-11": {
      "name": "Yeongun Intersection",
      "location": "Cheongju, North Chungcheong",
      "description": "A public camera view of Yeongun Intersection in Cheongju, North Chungcheong. Video provided by Cheongju Traffic Information Center."
    },
    "gumi-75": {
      "name": "North Gumi Interchange Gas Station Junction",
      "location": "Gumi, North Gyeongsang",
      "description": "A public camera view of North Gumi Interchange Gas Station Junction in Gumi, North Gyeongsang. Video provided by Gumi Traffic Information Center."
    },
    "jinju-1000001588": {
      "name": "Naedong Intersection · Toward Naedong School",
      "location": "Jinju, South Gyeongsang",
      "description": "A public camera view of Naedong Intersection · Toward Naedong School in Jinju, South Gyeongsang. Video provided by Jinju Traffic Information Center."
    },
    "busan-ctv0000009": {
      "name": "Jayu Market",
      "location": "Busanjin, Busan",
      "description": "A public camera view of Jayu Market in Busanjin, Busan. Video provided by Busan Traffic Information Service Center."
    },
    "paju-18": {
      "name": "Dure Park Intersection",
      "location": "Paju, Gyeonggi",
      "description": "A public camera view of Dure Park Intersection in Paju, Gyeonggi. Video provided by Paju Traffic Information Center."
    },
    "cheongju-39": {
      "name": "Ochang Chang-ri Intersection",
      "location": "Cheongju, North Chungcheong",
      "description": "A public camera view of Ochang Chang-ri Intersection in Cheongju, North Chungcheong. Video provided by Cheongju Traffic Information Center."
    },
    "gumi-76": {
      "name": "Civic Stadium Entrance",
      "location": "Gumi, North Gyeongsang",
      "description": "A public camera view of Civic Stadium Entrance in Gumi, North Gyeongsang. Video provided by Gumi Traffic Information Center."
    },
    "jinju-1000002172": {
      "name": "City Hall Intersection · Toward Old Jinju Station",
      "location": "Jinju, South Gyeongsang",
      "description": "A public camera view of City Hall Intersection · Toward Old Jinju Station in Jinju, South Gyeongsang. Video provided by Jinju Traffic Information Center."
    },
    "busan-ctv0000010": {
      "name": "Beomnaegol Intersection",
      "location": "Busanjin, Busan",
      "description": "A public camera view of Beomnaegol Intersection in Busanjin, Busan. Video provided by Busan Traffic Information Service Center."
    },
    "paju-6": {
      "name": "Munbal Intersection",
      "location": "Paju, Gyeonggi",
      "description": "A public camera view of Munbal Intersection in Paju, Gyeonggi. Video provided by Paju Traffic Information Center."
    },
    "cheongju-46": {
      "name": "Oecheon Junction",
      "location": "Cheongju, North Chungcheong",
      "description": "A public camera view of Oecheon Junction in Cheongju, North Chungcheong. Video provided by Cheongju Traffic Information Center."
    },
    "gumi-77": {
      "name": "Post Office Junction",
      "location": "Gumi, North Gyeongsang",
      "description": "A public camera view of Post Office Junction in Gumi, North Gyeongsang. Video provided by Gumi Traffic Information Center."
    },
    "jinju-1000002175": {
      "name": "City Hall Intersection · Toward Innovation City",
      "location": "Jinju, South Gyeongsang",
      "description": "A public camera view of City Hall Intersection · Toward Innovation City in Jinju, South Gyeongsang. Video provided by Jinju Traffic Information Center."
    },
    "busan-ctv0000011": {
      "name": "Cheonujang",
      "location": "Busanjin, Busan",
      "description": "A public camera view of Cheonujang in Busanjin, Busan. Video provided by Busan Traffic Information Service Center."
    },
    "paju-26": {
      "name": "Mirae-ro Intersection",
      "location": "Paju, Gyeonggi",
      "description": "A public camera view of Mirae-ro Intersection in Paju, Gyeonggi. Video provided by Paju Traffic Information Center."
    },
    "cheongju-48": {
      "name": "Seokgok Junction",
      "location": "Cheongju, North Chungcheong",
      "description": "A public camera view of Seokgok Junction in Cheongju, North Chungcheong. Video provided by Cheongju Traffic Information Center."
    },
    "gumi-78": {
      "name": "Gumi Somang Presbyterian Church",
      "location": "Gumi, North Gyeongsang",
      "description": "A public camera view of Gumi Somang Presbyterian Church in Gumi, North Gyeongsang. Video provided by Gumi Traffic Information Center."
    },
    "jinju-1000002180": {
      "name": "Sangdae Community Center · Toward Old Jinju Station",
      "location": "Jinju, South Gyeongsang",
      "description": "A public camera view of Sangdae Community Center · Toward Old Jinju Station in Jinju, South Gyeongsang. Video provided by Jinju Traffic Information Center."
    },
    "busan-ctv0000012": {
      "name": "Seomyeon Intersection",
      "location": "Busanjin, Busan",
      "description": "A public camera view of Seomyeon Intersection in Busanjin, Busan. Video provided by Busan Traffic Information Service Center."
    },
    "paju-78": {
      "name": "North Paju Nonghyup Intersection",
      "location": "Paju, Gyeonggi",
      "description": "A public camera view of North Paju Nonghyup Intersection in Paju, Gyeonggi. Video provided by Paju Traffic Information Center."
    },
    "cheongju-58": {
      "name": "Yullyang Bridge Intersection",
      "location": "Cheongju, North Chungcheong",
      "description": "A public camera view of Yullyang Bridge Intersection in Cheongju, North Chungcheong. Video provided by Cheongju Traffic Information Center."
    },
    "gumi-79": {
      "name": "Hanwha Systems Gumi Site",
      "location": "Gumi, North Gyeongsang",
      "description": "A public camera view of Hanwha Systems Gumi Site in Gumi, North Gyeongsang. Video provided by Gumi Traffic Information Center."
    },
    "jinju-1000003070": {
      "name": "Sinan Plaza · Toward Plaza No. 10",
      "location": "Jinju, South Gyeongsang",
      "description": "A public camera view of Sinan Plaza · Toward Plaza No. 10 in Jinju, South Gyeongsang. Video provided by Jinju Traffic Information Center."
    },
    "busan-ctv0000013": {
      "name": "Samjeon Intersection",
      "location": "Busanjin, Busan",
      "description": "A public camera view of Samjeon Intersection in Busanjin, Busan. Video provided by Busan Traffic Information Service Center."
    },
    "paju-11": {
      "name": "Seonyu Rotary",
      "location": "Paju, Gyeonggi",
      "description": "A public camera view of Seonyu Rotary in Paju, Gyeonggi. Video provided by Paju Traffic Information Center."
    },
    "gumi-8": {
      "name": "Otae Bridge Junction",
      "location": "Gumi, North Gyeongsang",
      "description": "A public camera view of Otae Bridge Junction in Gumi, North Gyeongsang. Video provided by Gumi Traffic Information Center."
    },
    "jinju-1000003074": {
      "name": "Sinan Plaza · Toward Jinjuseong Fortress",
      "location": "Jinju, South Gyeongsang",
      "description": "A public camera view of Sinan Plaza · Toward Jinjuseong Fortress in Jinju, South Gyeongsang. Video provided by Jinju Traffic Information Center."
    },
    "busan-ctv0000015": {
      "name": "Yangjeong Intersection",
      "location": "Busanjin, Busan",
      "description": "A public camera view of Yangjeong Intersection in Busanjin, Busan. Video provided by Busan Traffic Information Service Center."
    },
    "paju-96": {
      "name": "Yongmi Intersection No. 5",
      "location": "Paju, Gyeonggi",
      "description": "A public camera view of Yongmi Intersection No. 5 in Paju, Gyeonggi. Video provided by Paju Traffic Information Center."
    },
    "gumi-80": {
      "name": "LG Display P6E Plant",
      "location": "Gumi, North Gyeongsang",
      "description": "A public camera view of LG Display P6E Plant in Gumi, North Gyeongsang. Video provided by Gumi Traffic Information Center."
    },
    "jinju-1000003674": {
      "name": "Jungang Plaza · Toward Jinju High School",
      "location": "Jinju, South Gyeongsang",
      "description": "A public camera view of Jungang Plaza · Toward Jinju High School in Jinju, South Gyeongsang. Video provided by Jinju Traffic Information Center."
    },
    "busan-ctv0000016": {
      "name": "Busan Metropolitan Police",
      "location": "Yeonje, Busan",
      "description": "A public camera view of Busan Metropolitan Police in Yeonje, Busan. Video provided by Busan Traffic Information Service Center."
    },
    "paju-25": {
      "name": "Unjeong Lake Intersection",
      "location": "Paju, Gyeonggi",
      "description": "A public camera view of Unjeong Lake Intersection in Paju, Gyeonggi. Video provided by Paju Traffic Information Center."
    },
    "gumi-85": {
      "name": "Bisan Intersection",
      "location": "Gumi, North Gyeongsang",
      "description": "A public camera view of Bisan Intersection in Gumi, North Gyeongsang. Video provided by Gumi Traffic Information Center."
    },
    "jinju-1000003676": {
      "name": "Jungang Plaza · Toward Pyeonggeo",
      "location": "Jinju, South Gyeongsang",
      "description": "A public camera view of Jungang Plaza · Toward Pyeonggeo in Jinju, South Gyeongsang. Video provided by Jinju Traffic Information Center."
    },
    "busan-ctv0000017": {
      "name": "Yeonsan Intersection",
      "location": "Yeonje, Busan",
      "description": "A public camera view of Yeonsan Intersection in Yeonje, Busan. Video provided by Busan Traffic Information Service Center."
    },
    "paju-43": {
      "name": "Jangwol Bridge No. 2",
      "location": "Paju, Gyeonggi",
      "description": "A public camera view of Jangwol Bridge No. 2 in Paju, Gyeonggi. Video provided by Paju Traffic Information Center."
    },
    "gumi-86": {
      "name": "Jeonwon Living Feel Intersection",
      "location": "Gumi, North Gyeongsang",
      "description": "A public camera view of Jeonwon Living Feel Intersection in Gumi, North Gyeongsang. Video provided by Gumi Traffic Information Center."
    },
    "jinju-1000004319": {
      "name": "Old Jinju Station",
      "location": "Jinju, South Gyeongsang",
      "description": "A public camera view of Old Jinju Station in Jinju, South Gyeongsang. Video provided by Jinju Traffic Information Center."
    },
    "busan-ctv0000020": {
      "name": "Oncheon Bridge Intersection",
      "location": "Dongnae, Busan",
      "description": "A public camera view of Oncheon Bridge Intersection in Dongnae, Busan. Video provided by Busan Traffic Information Service Center."
    },
    "gumi-87": {
      "name": "Sinpyeong Intersection",
      "location": "Gumi, North Gyeongsang",
      "description": "A public camera view of Sinpyeong Intersection in Gumi, North Gyeongsang. Video provided by Gumi Traffic Information Center."
    },
    "jinju-1000004815": {
      "name": "Jinju Stadium Intersection",
      "location": "Jinju, South Gyeongsang",
      "description": "A public camera view of Jinju Stadium Intersection in Jinju, South Gyeongsang. Video provided by Jinju Traffic Information Center."
    },
    "busan-ctv0000021": {
      "name": "Pusan National University Intersection",
      "location": "Geumjeong, Busan",
      "description": "A public camera view of Pusan National University Intersection in Geumjeong, Busan. Video provided by Busan Traffic Information Service Center."
    },
    "gumi-88": {
      "name": "Jeongnim Intersection",
      "location": "Gumi, North Gyeongsang",
      "description": "A public camera view of Jeongnim Intersection in Gumi, North Gyeongsang. Video provided by Gumi Traffic Information Center."
    },
    "jinju-1000004820": {
      "name": "Chungmugong-dong · Complex 3",
      "location": "Jinju, South Gyeongsang",
      "description": "A public camera view of Chungmugong-dong · Complex 3 in Jinju, South Gyeongsang. Video provided by Jinju Traffic Information Center."
    },
    "busan-ctv0000023": {
      "name": "Gyeongbu Expressway Entrance",
      "location": "Geumjeong, Busan",
      "description": "A public camera view of Gyeongbu Expressway Entrance in Geumjeong, Busan. Video provided by Busan Traffic Information Service Center."
    },
    "jinju-1000004823": {
      "name": "Behind LH Headquarters",
      "location": "Jinju, South Gyeongsang",
      "description": "A public camera view of Behind LH Headquarters in Jinju, South Gyeongsang. Video provided by Jinju Traffic Information Center."
    },
    "busan-ctv0000026": {
      "name": "Guseo Interchange",
      "location": "Geumjeong, Busan",
      "description": "A public camera view of Guseo Interchange in Geumjeong, Busan. Video provided by Busan Traffic Information Service Center."
    },
    "jinju-1000004825": {
      "name": "Chungmugong-dong · Complex 11",
      "location": "Jinju, South Gyeongsang",
      "description": "A public camera view of Chungmugong-dong · Complex 11 in Jinju, South Gyeongsang. Video provided by Jinju Traffic Information Center."
    },
    "busan-ctv0000042": {
      "name": "Nambu Driving Test Center Entrance",
      "location": "Nam-gu, Busan",
      "description": "A public camera view of Nambu Driving Test Center Entrance in Nam-gu, Busan. Video provided by Busan Traffic Information Service Center."
    },
    "jinju-1000005303": {
      "name": "Plaza No. 10 · Toward Daesa Intersection",
      "location": "Jinju, South Gyeongsang",
      "description": "A public camera view of Plaza No. 10 · Toward Daesa Intersection in Jinju, South Gyeongsang. Video provided by Jinju Traffic Information Center."
    },
    "busan-ctv0000043": {
      "name": "Plaza No. 49",
      "location": "Suyeong, Busan",
      "description": "A public camera view of Plaza No. 49 in Suyeong, Busan. Video provided by Busan Traffic Information Service Center."
    },
    "jinju-1000005305": {
      "name": "Plaza No. 10 · Toward Jungang Chinmorae",
      "location": "Jinju, South Gyeongsang",
      "description": "A public camera view of Plaza No. 10 · Toward Jungang Chinmorae in Jinju, South Gyeongsang. Video provided by Jinju Traffic Information Center."
    },
    "busan-ctv0000044": {
      "name": "Dongmyeong Five-way Junction",
      "location": "Nam-gu, Busan",
      "description": "A public camera view of Dongmyeong Five-way Junction in Nam-gu, Busan. Video provided by Busan Traffic Information Service Center."
    },
    "jinju-1000005307": {
      "name": "Plaza No. 10 · Toward Huimang Bridge",
      "location": "Jinju, South Gyeongsang",
      "description": "A public camera view of Plaza No. 10 · Toward Huimang Bridge in Jinju, South Gyeongsang. Video provided by Jinju Traffic Information Center."
    },
    "busan-ctv0000045": {
      "name": "UN Intersection",
      "location": "Nam-gu, Busan",
      "description": "A public camera view of UN Intersection in Nam-gu, Busan. Video provided by Busan Traffic Information Service Center."
    },
    "yeongsan-110024": {
      "name": "Daeseok Bridge",
      "location": "Hadong, South Gyeongsang",
      "description": "A public camera view of Daeseok Bridge in Hadong, South Gyeongsang. Video provided by Yeongsan River Flood Control Office."
    },
    "busan-ctv0000046": {
      "name": "Dongcheon Junction",
      "location": "Nam-gu, Busan",
      "description": "A public camera view of Dongcheon Junction in Nam-gu, Busan. Video provided by Busan Traffic Information Service Center."
    },
    "yeongsan-110052": {
      "name": "Gatan Bridge",
      "location": "Hadong, South Gyeongsang",
      "description": "A public camera view of Gatan Bridge in Hadong, South Gyeongsang. Video provided by Yeongsan River Flood Control Office."
    },
    "busan-ctv0000047": {
      "name": "Hamajeong Intersection",
      "location": "Busanjin, Busan",
      "description": "A public camera view of Hamajeong Intersection in Busanjin, Busan. Video provided by Busan Traffic Information Service Center."
    },
    "yeongsan-13019": {
      "name": "Eumnae-ri",
      "location": "Hadong, South Gyeongsang",
      "description": "A public camera view of Eumnae-ri in Hadong, South Gyeongsang. Video provided by Yeongsan River Flood Control Office."
    },
    "busan-ctv0000048": {
      "name": "Geoseong Intersection",
      "location": "Yeonje, Busan",
      "description": "A public camera view of Geoseong Intersection in Yeonje, Busan. Video provided by Busan Traffic Information Service Center."
    },
    "busan-ctv0000050": {
      "name": "Pier No. 3",
      "location": "Dong-gu, Busan",
      "description": "A public camera view of Pier No. 3 in Dong-gu, Busan. Video provided by Busan Traffic Information Service Center."
    },
    "busan-ctv0000057": {
      "name": "Songdo Intersection",
      "location": "Seo-gu, Busan",
      "description": "A public camera view of Songdo Intersection in Seo-gu, Busan. Video provided by Busan Traffic Information Service Center."
    },
    "busan-ctv0000059": {
      "name": "Jwacheon Intersection",
      "location": "Gijang, Busan",
      "description": "A public camera view of Jwacheon Intersection in Gijang, Busan. Video provided by Busan Traffic Information Service Center."
    },
    "busan-ctv0000060": {
      "name": "Gyori Junction",
      "location": "Gijang, Busan",
      "description": "A public camera view of Gyori Junction in Gijang, Busan. Video provided by Busan Traffic Information Service Center."
    },
    "busan-ctv0000062": {
      "name": "Togok Intersection",
      "location": "Yeonje, Busan",
      "description": "A public camera view of Togok Intersection in Yeonje, Busan. Video provided by Busan Traffic Information Service Center."
    },
    "busan-ctv0000063": {
      "name": "Gwajeong Intersection",
      "location": "Yeonje, Busan",
      "description": "A public camera view of Gwajeong Intersection in Yeonje, Busan. Video provided by Busan Traffic Information Service Center."
    },
    "busan-ctv0000065": {
      "name": "Busan Military Manpower Office",
      "location": "Suyeong, Busan",
      "description": "A public camera view of Busan Military Manpower Office in Suyeong, Busan. Video provided by Busan Traffic Information Service Center."
    },
    "busan-ctv0000066": {
      "name": "Seokdae",
      "location": "Geumjeong, Busan",
      "description": "A public camera view of Seokdae in Geumjeong, Busan. Video provided by Busan Traffic Information Service Center."
    },
    "busan-ctv0000067": {
      "name": "Jangsan Station Intersection",
      "location": "Haeundae, Busan",
      "description": "A public camera view of Jangsan Station Intersection in Haeundae, Busan. Video provided by Busan Traffic Information Service Center."
    },
    "busan-ctv0000071": {
      "name": "Samnak Interchange",
      "location": "Sasang, Busan",
      "description": "A public camera view of Samnak Interchange in Sasang, Busan. Video provided by Busan Traffic Information Service Center."
    },
    "busan-ctv0000072": {
      "name": "Lotte Hotel",
      "location": "Busanjin, Busan",
      "description": "A public camera view of Lotte Hotel in Busanjin, Busan. Video provided by Busan Traffic Information Service Center."
    },
    "busan-ctv0000073": {
      "name": "Gamjeon Interchange",
      "location": "Sasang, Busan",
      "description": "A public camera view of Gamjeon Interchange in Sasang, Busan. Video provided by Busan Traffic Information Service Center."
    },
    "busan-ctv0000074": {
      "name": "West Busan Interchange",
      "location": "Gangseo, Busan",
      "description": "A public camera view of West Busan Interchange in Gangseo, Busan. Video provided by Busan Traffic Information Service Center."
    },
    "busan-ctv0000075": {
      "name": "Sasang District Office",
      "location": "Sasang, Busan",
      "description": "A public camera view of Sasang District Office in Sasang, Busan. Video provided by Busan Traffic Information Service Center."
    },
    "busan-ctv0000076": {
      "name": "Hakjang",
      "location": "Sasang, Busan",
      "description": "A public camera view of Hakjang in Sasang, Busan. Video provided by Busan Traffic Information Service Center."
    },
    "busan-ctv0000078": {
      "name": "Cheonghak Fire Station",
      "location": "Yeongdo, Busan",
      "description": "A public camera view of Cheonghak Fire Station in Yeongdo, Busan. Video provided by Busan Traffic Information Service Center."
    },
    "busan-ctv0000079": {
      "name": "Centum Middle School",
      "location": "Haeundae, Busan",
      "description": "A public camera view of Centum Middle School in Haeundae, Busan. Video provided by Busan Traffic Information Service Center."
    },
    "busan-ctv0000080": {
      "name": "Yeonji Junction",
      "location": "Busanjin, Busan",
      "description": "A public camera view of Yeonji Junction in Busanjin, Busan. Video provided by Busan Traffic Information Service Center."
    },
    "busan-ctv0000082": {
      "name": "Jinyang Intersection",
      "location": "Busanjin, Busan",
      "description": "A public camera view of Jinyang Intersection in Busanjin, Busan. Video provided by Busan Traffic Information Service Center."
    },
    "busan-ctv0000088": {
      "name": "Olympic Intersection",
      "location": "Haeundae, Busan",
      "description": "A public camera view of Olympic Intersection in Haeundae, Busan. Video provided by Busan Traffic Information Service Center."
    },
    "busan-ctv0000090": {
      "name": "Wondong Interchange",
      "location": "Dongnae, Busan",
      "description": "A public camera view of Wondong Interchange in Dongnae, Busan. Video provided by Busan Traffic Information Service Center."
    },
    "busan-ctv0000091": {
      "name": "Allak Intersection",
      "location": "Dongnae, Busan",
      "description": "A public camera view of Allak Intersection in Dongnae, Busan. Video provided by Busan Traffic Information Service Center."
    }
  };

  const extraAliases = {
    'kbs-109242': 'N Seoul Tower Namsan Tower Seoul skyline',
    'kbs-9959': 'Han River Hangang',
    'kbs-9982': 'Mara Island Marado',
    'kbs-9983': 'Gageo Island Gageodo',
    'kbs-9994': 'Odong Island Odongdo',
    'kbs-9958': 'Yeonpyeongdo Yeonpyeong Island',
    'kbs-9971': 'Mount Jiri Jirisan Baemsagol Valley',
    'kbs-9991': 'Suyeong Bay Busan coast',
    'gits-5253': 'Seowonju IC West Wonju Interchange',
    'busan-ctv0000074': 'Seobusan IC West Busan Interchange',
    'daegu-04-107': 'Namdaegu IC South Daegu Interchange',
    'busan-ctv0000067': 'Jangsan subway station',
    'busan-ctv0000105': 'Dadaepo beach coast sea',
    'busan-ctv0000021': 'Busan University PNU Pusan National University'
  };
  window.KOREA_EN = { regions, providers, categoryLabels, regionAliases, cameras };
  window.KOREA_DISPLAY_CAMERAS = (window.KOREA_CAMERAS || []).map(camera => {
    const translated = cameras[camera.id];
    const region = regions[camera.region] || 'South Korea';
    const provider = providers[camera.provider] || 'Public camera provider';
    // Diagnostic-only candidates are intentionally identified by their source ID.
    // Every camera in the public 400-item catalog has an explicit English entry.
    const name = translated?.name || `Camera ${camera.id}`;
    const location = translated?.location || region;
    const description = translated?.description || `A public camera in ${location}. Video provided by ${provider}.`;
    const searchAliases = [camera.name, camera.location, camera.region, camera.provider,
      camera.categoryLabel, regionAliases[camera.region] || '', extraAliases[camera.id] || '',
      camera.category === 'sea' ? 'sea ocean beach coast' : camera.category === 'nature' ? 'nature river mountain forest' : 'city urban street traffic',
      name.replace(/Intersection/g, 'Crossroads').replace(/Interchange/g, 'IC')].filter(Boolean).join(' ');
    return { ...camera, name, location, description, region, provider,
      categoryLabel: categoryLabels[camera.category] || 'View', searchAliases };
  });
})();
