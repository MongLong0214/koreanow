// Relay only catalogued public video sources. No arbitrary hosts.
const hlsManifestLimit = 256 * 1024;
const hlsSegmentLimit = 8 * 1024 * 1024;
// A measured High1 5.4 MB fragment took 18.6 s through the preview transport.
// Bound the whole transfer at 25 s while exposing validated bytes immediately.
const hlsSegmentDeadlineMs = 25_000;
const hlsManifestDeadlineMs = 20_000;
const hlsMujuOrigin = 'http://muju.cache.cdn.cloudn.co.kr';
// Exact public ID-to-URL map from the pinned Cheongju catalog.
// IDs and media channel numbers are different; never derive one from the other.
const hlsCheongjuSources = Object.freeze({
  "cheongju-1": "http://211.236.64.77:1935/84/playlist.m3u8",
  "cheongju-2": "http://211.236.64.77:1935/85/playlist.m3u8",
  "cheongju-3": "http://211.236.64.77:1935/86/playlist.m3u8",
  "cheongju-4": "http://211.236.64.77:1935/87/playlist.m3u8",
  "cheongju-5": "http://211.236.64.77:1935/88/playlist.m3u8",
  "cheongju-6": "http://211.236.64.77:1935/89/playlist.m3u8",
  "cheongju-7": "http://211.236.64.77:1935/90/playlist.m3u8",
  "cheongju-8": "http://211.236.64.77:1935/91/playlist.m3u8",
  "cheongju-9": "http://211.236.64.77:1935/92/playlist.m3u8",
  "cheongju-10": "http://211.236.64.77:1935/93/playlist.m3u8",
  "cheongju-11": "http://211.236.64.77:1935/94/playlist.m3u8",
  "cheongju-12": "http://211.236.64.77:1935/95/playlist.m3u8",
  "cheongju-13": "http://211.236.64.77:1935/96/playlist.m3u8",
  "cheongju-14": "http://211.236.64.77:1935/97/playlist.m3u8",
  "cheongju-15": "http://211.236.64.77:1935/98/playlist.m3u8",
  "cheongju-16": "http://211.236.64.77:1935/99/playlist.m3u8",
  "cheongju-17": "http://211.236.64.77:1935/100/playlist.m3u8",
  "cheongju-18": "http://211.236.64.77:1935/101/playlist.m3u8",
  "cheongju-19": "http://211.236.64.77:1935/102/playlist.m3u8",
  "cheongju-20": "http://211.236.64.77:1935/103/playlist.m3u8",
  "cheongju-21": "http://211.236.64.77:1935/104/playlist.m3u8",
  "cheongju-22": "http://211.236.64.77:1935/105/playlist.m3u8",
  "cheongju-23": "http://211.236.64.77:1935/106/playlist.m3u8",
  "cheongju-24": "http://211.236.64.77:1935/107/playlist.m3u8",
  "cheongju-25": "http://211.236.64.77:1935/108/playlist.m3u8",
  "cheongju-26": "http://211.236.64.77:1935/109/playlist.m3u8",
  "cheongju-27": "http://211.236.64.77:1935/110/playlist.m3u8",
  "cheongju-28": "http://211.236.64.77:1935/111/playlist.m3u8",
  "cheongju-29": "http://211.236.64.77:1935/112/playlist.m3u8",
  "cheongju-30": "http://211.236.64.77:1935/113/playlist.m3u8",
  "cheongju-31": "http://211.236.64.77:1935/114/playlist.m3u8",
  "cheongju-32": "http://211.236.64.77:1935/115/playlist.m3u8",
  "cheongju-33": "http://211.236.64.77:1935/116/playlist.m3u8",
  "cheongju-34": "http://211.236.64.77:1935/117/playlist.m3u8",
  "cheongju-35": "http://211.236.64.77:1935/118/playlist.m3u8",
  "cheongju-36": "http://211.236.64.77:1935/119/playlist.m3u8",
  "cheongju-37": "http://211.236.64.77:1935/120/playlist.m3u8",
  "cheongju-38": "http://211.236.64.77:1935/121/playlist.m3u8",
  "cheongju-39": "http://211.236.64.77:1935/122/playlist.m3u8",
  "cheongju-40": "http://211.236.64.77:1935/123/playlist.m3u8",
  "cheongju-41": "http://211.236.64.77:1935/124/playlist.m3u8",
  "cheongju-43": "http://211.236.64.77:1935/126/playlist.m3u8",
  "cheongju-44": "http://211.236.64.77:1935/127/playlist.m3u8",
  "cheongju-45": "http://211.236.64.77:1935/128/playlist.m3u8",
  "cheongju-46": "http://211.236.64.77:1935/129/playlist.m3u8",
  "cheongju-47": "http://211.236.64.77:1935/130/playlist.m3u8",
  "cheongju-48": "http://211.236.64.77:1935/131/playlist.m3u8",
  "cheongju-49": "http://211.236.64.77:1935/132/playlist.m3u8",
  "cheongju-50": "http://211.236.64.77:1935/133/playlist.m3u8",
  "cheongju-51": "http://211.236.64.77:1935/134/playlist.m3u8",
  "cheongju-52": "http://211.236.64.77:1935/135/playlist.m3u8",
  "cheongju-53": "http://211.236.64.77:1935/136/playlist.m3u8",
  "cheongju-54": "http://211.236.64.77:1935/137/playlist.m3u8",
  "cheongju-55": "http://211.236.64.77:1935/138/playlist.m3u8",
  "cheongju-56": "http://211.236.64.77:1935/139/playlist.m3u8",
  "cheongju-57": "http://211.236.64.77:1935/140/playlist.m3u8",
  "cheongju-58": "http://211.236.64.77:1935/141/playlist.m3u8",
  "cheongju-59": "http://211.236.64.77:1935/142/playlist.m3u8",
  "cheongju-60": "http://211.236.64.77:1935/143/playlist.m3u8",
  "cheongju-61": "http://211.236.64.77:1935/144/playlist.m3u8",
  "cheongju-62": "http://211.236.64.77:1935/145/playlist.m3u8",
  "cheongju-63": "http://211.236.64.77:1935/146/playlist.m3u8",
  "cheongju-64": "http://211.236.64.77:1935/147/playlist.m3u8",
  "cheongju-65": "http://211.236.64.77:1935/148/playlist.m3u8",
  "cheongju-66": "http://211.236.64.77:1935/149/playlist.m3u8",
  "cheongju-67": "http://211.236.64.77:1935/150/playlist.m3u8",
  "cheongju-68": "http://211.236.64.77:1935/151/playlist.m3u8",
  "cheongju-69": "http://211.236.64.77:1935/152/playlist.m3u8",
  "cheongju-70": "http://211.236.64.77:1935/153/playlist.m3u8",
  "cheongju-71": "http://211.236.64.77:1935/154/playlist.m3u8",
  "cheongju-72": "http://211.236.64.77:1935/155/playlist.m3u8",
  "cheongju-73": "http://211.236.64.77:1935/159/playlist.m3u8",
  "cheongju-74": "http://211.236.64.77:1935/156/playlist.m3u8",
  "cheongju-75": "http://211.236.64.77:1935/158/playlist.m3u8",
  "cheongju-76": "http://211.236.64.77:1935/157/playlist.m3u8",
  "cheongju-99": "http://211.236.64.77:1935/189/playlist.m3u8",
  "cheongju-100": "http://211.236.64.77:1935/204/playlist.m3u8",
  "cheongju-101": "http://211.236.64.77:1935/205/playlist.m3u8",
  "cheongju-102": "http://211.236.64.77:1935/206/playlist.m3u8",
  "cheongju-103": "http://211.236.64.77:1935/207/playlist.m3u8",
  "cheongju-104": "http://211.236.64.77:1935/208/playlist.m3u8"
});
// Exact anonymous public Paju ID-to-URL map; public IDs do not always equal stream channels.
const hlsPajuSources = Object.freeze({
  "paju-32": "https://trafficcctv.paju.go.kr:443/live/cctv_32.stream/playlist.m3u8",
  "paju-131": "https://trafficcctv.paju.go.kr:443/live/cctv_126.stream/playlist.m3u8",
  "paju-99": "https://trafficcctv.paju.go.kr:443/live/cctv_100.stream/playlist.m3u8",
  "paju-103": "https://trafficcctv.paju.go.kr:443/live/cctv_101.stream/playlist.m3u8",
  "paju-34": "https://trafficcctv.paju.go.kr:443/live/cctv_34.stream/playlist.m3u8",
  "paju-54": "https://trafficcctv.paju.go.kr:443/live/cctv_54.stream/playlist.m3u8",
  "paju-100": "https://trafficcctv.paju.go.kr:443/live/cctv_102.stream/playlist.m3u8",
  "paju-104": "https://trafficcctv.paju.go.kr:443/live/cctv_103.stream/playlist.m3u8",
  "paju-35": "https://trafficcctv.paju.go.kr:443/live/cctv_35.stream/playlist.m3u8",
  "paju-95": "https://trafficcctv.paju.go.kr:443/live/cctv_95.stream/playlist.m3u8",
  "paju-81": "https://trafficcctv.paju.go.kr:443/live/cctv_81.stream/playlist.m3u8",
  "paju-82": "https://trafficcctv.paju.go.kr:443/live/cctv_82.stream/playlist.m3u8",
  "paju-9": "https://trafficcctv.paju.go.kr:443/live/cctv_09.stream/playlist.m3u8",
  "paju-73": "https://trafficcctv.paju.go.kr:443/live/cctv_73.stream/playlist.m3u8",
  "paju-33": "https://trafficcctv.paju.go.kr:443/live/cctv_33.stream/playlist.m3u8",
  "paju-42": "https://trafficcctv.paju.go.kr:443/live/cctv_42.stream/playlist.m3u8",
  "paju-69": "https://trafficcctv.paju.go.kr:443/live/cctv_69.stream/playlist.m3u8",
  "paju-4": "https://trafficcctv.paju.go.kr:443/live/cctv_04.stream/playlist.m3u8",
  "paju-53": "https://trafficcctv.paju.go.kr:443/live/cctv_53.stream/playlist.m3u8",
  "paju-2": "https://trafficcctv.paju.go.kr:443/live/cctv_02.stream/playlist.m3u8",
  "paju-51": "https://trafficcctv.paju.go.kr:443/live/cctv_51.stream/playlist.m3u8",
  "paju-5": "https://trafficcctv.paju.go.kr:443/live/cctv_05.stream/playlist.m3u8",
  "paju-10": "https://trafficcctv.paju.go.kr:443/live/cctv_10.stream/playlist.m3u8",
  "paju-56": "https://trafficcctv.paju.go.kr:443/live/cctv_56.stream/playlist.m3u8",
  "paju-7": "https://trafficcctv.paju.go.kr:443/live/cctv_07.stream/playlist.m3u8",
  "paju-87": "https://trafficcctv.paju.go.kr:443/live/cctv_87.stream/playlist.m3u8",
  "paju-84": "https://trafficcctv.paju.go.kr:443/live/cctv_84.stream/playlist.m3u8",
  "paju-70": "https://trafficcctv.paju.go.kr:443/live/cctv_70.stream/playlist.m3u8",
  "paju-15": "https://trafficcctv.paju.go.kr:443/live/cctv_15.stream/playlist.m3u8",
  "paju-72": "https://trafficcctv.paju.go.kr:443/live/cctv_72.stream/playlist.m3u8",
  "paju-80": "https://trafficcctv.paju.go.kr:443/live/cctv_80.stream/playlist.m3u8",
  "paju-30": "https://trafficcctv.paju.go.kr:443/live/cctv_30.stream/playlist.m3u8",
  "paju-50": "https://trafficcctv.paju.go.kr:443/live/cctv_50.stream/playlist.m3u8",
  "paju-31": "https://trafficcctv.paju.go.kr:443/live/cctv_31.stream/playlist.m3u8",
  "paju-18": "https://trafficcctv.paju.go.kr:443/live/cctv_18.stream/playlist.m3u8",
  "paju-62": "https://trafficcctv.paju.go.kr:443/live/cctv_62.stream/playlist.m3u8",
  "paju-16": "https://trafficcctv.paju.go.kr:443/live/cctv_16.stream/playlist.m3u8",
  "paju-64": "https://trafficcctv.paju.go.kr:443/live/cctv_64.stream/playlist.m3u8",
  "paju-6": "https://trafficcctv.paju.go.kr:443/live/cctv_06.stream/playlist.m3u8",
  "paju-12": "https://trafficcctv.paju.go.kr:443/live/cctv_12.stream/playlist.m3u8",
  "paju-60": "https://trafficcctv.paju.go.kr:443/live/cctv_60.stream/playlist.m3u8",
  "paju-36": "https://trafficcctv.paju.go.kr:443/live/cctv_36.stream/playlist.m3u8",
  "paju-55": "https://trafficcctv.paju.go.kr:443/live/cctv_55.stream/playlist.m3u8",
  "paju-26": "https://trafficcctv.paju.go.kr:443/live/cctv_26.stream/playlist.m3u8",
  "paju-14": "https://trafficcctv.paju.go.kr:443/live/cctv_14.stream/playlist.m3u8",
  "paju-74": "https://trafficcctv.paju.go.kr:443/live/cctv_74.stream/playlist.m3u8",
  "paju-67": "https://trafficcctv.paju.go.kr:443/live/cctv_67.stream/playlist.m3u8",
  "paju-75": "https://trafficcctv.paju.go.kr:443/live/cctv_75.stream/playlist.m3u8",
  "paju-63": "https://trafficcctv.paju.go.kr:443/live/cctv_63.stream/playlist.m3u8",
  "paju-78": "https://trafficcctv.paju.go.kr:443/live/cctv_78.stream/playlist.m3u8",
  "paju-71": "https://trafficcctv.paju.go.kr:443/live/cctv_71.stream/playlist.m3u8",
  "paju-28": "https://trafficcctv.paju.go.kr:443/live/cctv_28.stream/playlist.m3u8",
  "paju-44": "https://trafficcctv.paju.go.kr:443/live/cctv_44.stream/playlist.m3u8",
  "paju-93": "https://trafficcctv.paju.go.kr:443/live/cctv_93.stream/playlist.m3u8",
  "paju-45": "https://trafficcctv.paju.go.kr:443/live/cctv_45.stream/playlist.m3u8",
  "paju-29": "https://trafficcctv.paju.go.kr:443/live/cctv_29.stream/playlist.m3u8",
  "paju-76": "https://trafficcctv.paju.go.kr:443/live/cctv_76.stream/playlist.m3u8",
  "paju-101": "https://trafficcctv.paju.go.kr:443/live/cctv_104.stream/playlist.m3u8",
  "paju-105": "https://trafficcctv.paju.go.kr:443/live/cctv_105.stream/playlist.m3u8",
  "paju-48": "https://trafficcctv.paju.go.kr:443/live/cctv_48.stream/playlist.m3u8",
  "paju-21": "https://trafficcctv.paju.go.kr:443/live/cctv_21.stream/playlist.m3u8",
  "paju-11": "https://trafficcctv.paju.go.kr:443/live/cctv_11.stream/playlist.m3u8",
  "paju-3": "https://trafficcctv.paju.go.kr:443/live/cctv_03.stream/playlist.m3u8",
  "paju-52": "https://trafficcctv.paju.go.kr:443/live/cctv_52.stream/playlist.m3u8",
  "paju-39": "https://trafficcctv.paju.go.kr:443/live/cctv_39.stream/playlist.m3u8",
  "paju-37": "https://trafficcctv.paju.go.kr:443/live/cctv_37.stream/playlist.m3u8",
  "paju-83": "https://trafficcctv.paju.go.kr:443/live/cctv_83.stream/playlist.m3u8",
  "paju-49": "https://trafficcctv.paju.go.kr:443/live/cctv_49.stream/playlist.m3u8",
  "paju-47": "https://trafficcctv.paju.go.kr:443/live/cctv_47.stream/playlist.m3u8",
  "paju-117": "https://trafficcctv.paju.go.kr:443/live/cctv_117.stream/playlist.m3u8",
  "paju-108": "https://trafficcctv.paju.go.kr:443/live/cctv_118.stream/playlist.m3u8",
  "paju-118": "https://trafficcctv.paju.go.kr:443/live/cctv_119.stream/playlist.m3u8",
  "paju-119": "https://trafficcctv.paju.go.kr:443/live/cctv_120.stream/playlist.m3u8",
  "paju-120": "https://trafficcctv.paju.go.kr:443/live/cctv_121.stream/playlist.m3u8",
  "paju-57": "https://trafficcctv.paju.go.kr:443/live/cctv_57.stream/playlist.m3u8",
  "paju-79": "https://trafficcctv.paju.go.kr:443/live/cctv_79.stream/playlist.m3u8",
  "paju-121": "https://trafficcctv.paju.go.kr:443/live/cctv_106.stream/playlist.m3u8",
  "paju-85": "https://trafficcctv.paju.go.kr:443/live/cctv_85.stream/playlist.m3u8",
  "paju-41": "https://trafficcctv.paju.go.kr:443/live/cctv_41.stream/playlist.m3u8",
  "paju-68": "https://trafficcctv.paju.go.kr:443/live/cctv_68.stream/playlist.m3u8",
  "paju-96": "https://trafficcctv.paju.go.kr:443/live/cctv_96.stream/playlist.m3u8",
  "paju-107": "https://trafficcctv.paju.go.kr:443/live/cctv_107.stream/playlist.m3u8",
  "paju-113": "https://trafficcctv.paju.go.kr:443/live/cctv_108.stream/playlist.m3u8",
  "paju-114": "https://trafficcctv.paju.go.kr:443/live/cctv_109.stream/playlist.m3u8",
  "paju-115": "https://trafficcctv.paju.go.kr:443/live/cctv_110.stream/playlist.m3u8",
  "paju-116": "https://trafficcctv.paju.go.kr:443/live/cctv_111.stream/playlist.m3u8",
  "paju-24": "https://trafficcctv.paju.go.kr:443/live/cctv_24.stream/playlist.m3u8",
  "paju-23": "https://trafficcctv.paju.go.kr:443/live/cctv_23.stream/playlist.m3u8",
  "paju-20": "https://trafficcctv.paju.go.kr:443/live/cctv_20.stream/playlist.m3u8",
  "paju-22": "https://trafficcctv.paju.go.kr:443/live/cctv_22.stream/playlist.m3u8",
  "paju-25": "https://trafficcctv.paju.go.kr:443/live/cctv_25.stream/playlist.m3u8",
  "paju-46": "https://trafficcctv.paju.go.kr:443/live/cctv_46.stream/playlist.m3u8",
  "paju-8": "https://trafficcctv.paju.go.kr:443/live/cctv_08.stream/playlist.m3u8",
  "paju-58": "https://trafficcctv.paju.go.kr:443/live/cctv_58.stream/playlist.m3u8",
  "paju-66": "https://trafficcctv.paju.go.kr:443/live/cctv_66.stream/playlist.m3u8",
  "paju-40": "https://trafficcctv.paju.go.kr:443/live/cctv_40.stream/playlist.m3u8",
  "paju-43": "https://trafficcctv.paju.go.kr:443/live/cctv_43.stream/playlist.m3u8",
  "paju-94": "https://trafficcctv.paju.go.kr:443/live/cctv_94.stream/playlist.m3u8",
  "paju-13": "https://trafficcctv.paju.go.kr:443/live/cctv_13.stream/playlist.m3u8",
  "paju-61": "https://trafficcctv.paju.go.kr:443/live/cctv_61.stream/playlist.m3u8",
  "paju-38": "https://trafficcctv.paju.go.kr:443/live/cctv_38.stream/playlist.m3u8",
  "paju-19": "https://trafficcctv.paju.go.kr:443/live/cctv_19.stream/playlist.m3u8",
  "paju-91": "https://trafficcctv.paju.go.kr:443/live/cctv_91.stream/playlist.m3u8",
  "paju-88": "https://trafficcctv.paju.go.kr:443/live/cctv_88.stream/playlist.m3u8",
  "paju-86": "https://trafficcctv.paju.go.kr:443/live/cctv_86.stream/playlist.m3u8",
  "paju-92": "https://trafficcctv.paju.go.kr:443/live/cctv_92.stream/playlist.m3u8",
  "paju-97": "https://trafficcctv.paju.go.kr:443/live/cctv_97.stream/playlist.m3u8",
  "paju-106": "https://trafficcctv.paju.go.kr:443/live/cctv_112.stream/playlist.m3u8",
  "paju-109": "https://trafficcctv.paju.go.kr:443/live/cctv_113.stream/playlist.m3u8",
  "paju-110": "https://trafficcctv.paju.go.kr:443/live/cctv_114.stream/playlist.m3u8",
  "paju-111": "https://trafficcctv.paju.go.kr:443/live/cctv_115.stream/playlist.m3u8",
  "paju-112": "https://trafficcctv.paju.go.kr:443/live/cctv_116.stream/playlist.m3u8",
  "paju-89": "https://trafficcctv.paju.go.kr:443/live/cctv_89.stream/playlist.m3u8",
  "paju-59": "https://trafficcctv.paju.go.kr:443/live/cctv_59.stream/playlist.m3u8",
  "paju-98": "https://trafficcctv.paju.go.kr:443/live/cctv_98.stream/playlist.m3u8",
  "paju-102": "https://trafficcctv.paju.go.kr:443/live/cctv_99.stream/playlist.m3u8",
  "paju-1": "https://trafficcctv.paju.go.kr:443/live/cctv_01.stream/playlist.m3u8",
  "paju-90": "https://trafficcctv.paju.go.kr:443/live/cctv_90.stream/playlist.m3u8",
  "paju-27": "https://trafficcctv.paju.go.kr:443/live/cctv_27.stream/playlist.m3u8",
  "paju-77": "https://trafficcctv.paju.go.kr:443/live/cctv_77.stream/playlist.m3u8",
  "paju-17": "https://trafficcctv.paju.go.kr:443/live/cctv_17.stream/playlist.m3u8",
  "paju-65": "https://trafficcctv.paju.go.kr:443/live/cctv_65.stream/playlist.m3u8"
});
const hlsJejuIds = new Set(['100001','100009','100007','100008','100011','100002','100005','100010','100012','100013','100006','100004','100017','100015','100023']);
// Workers require a hostname rather than an IP literal. These DNS-only names
// resolve to the exact public origins published by the providers. No proxy or
// credentials are involved; the original origin still validates playlist URIs.
// Verification and the external DNS dependency are documented in qa/.
const hlsTransportOrigins = {
  jeju: 'http://59.8.86.94.nip.io:8080',
  high1: 'http://59.30.12.195.nip.io:1935',
  cheongju: 'http://211.236.64.77.nip.io:1935'
};

class HlsRelayFailure extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; }
}

function hlsError(request, status, code, headers = {}) {
  return new Response(request.method === 'HEAD' ? null : JSON.stringify({ error: { code, message: '영상 원본을 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.' } }), {
    status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers }
  });
}

function hlsSource(entry, id) {
  if (!entry || typeof entry.streamUrl !== 'string') return null;
  let url;
  try { url = new URL(entry.streamUrl); } catch { return null; }
  if (url.username || url.password || url.search || url.hash || /[%\\]/.test(entry.streamUrl)) return null;
  if (entry.providerType === 'jeju') {
    const match = /^\/media\/api\/v1\/hls\/vurix\/192871\/(\d+)\/0\/0$/.exec(url.pathname);
    if (url.origin !== 'http://59.8.86.94:8080' || !match || !hlsJejuIds.has(match[1])) return null;
    return { url, type: 'jeju' };
  }
  if (entry.providerType === 'yangyang') {
    const match = /^\/rscFiles\/POSTDATA\/CCTV\/(007|009)\/\1_stream\.m3ust$/.exec(url.pathname);
    if (url.origin !== 'https://weather.yangyang.go.kr' || !match) return null;
    return { url, type: 'yangyang', channel: match[1] };
  }
  if (entry.providerType === 'yeongsan') {
    const match = /^\/live\/cctv(\d{5,6})\/hls\.m3u8$/.exec(url.pathname);
    if (url.origin !== 'https://cctvlo.yeongsanriver.go.kr' || !match) return null;
    return { url, type: 'yeongsan', channel: match[1] };
  }
  if (entry.providerType === 'high1') {
    const match = /^\/live\/ch([1-5])\.stream\/playlist\.m3u8$/.exec(url.pathname);
    if (url.origin !== 'http://59.30.12.195:1935' || !match) return null;
    return { url, type: 'high1', channel: match[1] };
  }
  if (entry.providerType === 'cheongju') {
    if (!Object.prototype.hasOwnProperty.call(hlsCheongjuSources, id) ||
        entry.streamUrl !== hlsCheongjuSources[id]) return null;
    const match = /^\/([0-9]+)\/playlist\.m3u8$/.exec(url.pathname);
    if (url.origin !== 'http://211.236.64.77:1935' || !match) return null;
    return { url, type: 'cheongju', channel: match[1] };
  }
  if (entry.providerType === 'paju') {
    if (!Object.prototype.hasOwnProperty.call(hlsPajuSources, id) ||
        entry.streamUrl !== hlsPajuSources[id]) return null;
    const match = /^\/live\/cctv_([0-9]+)\.stream\/playlist\.m3u8$/.exec(url.pathname);
    if (url.origin !== 'https://trafficcctv.paju.go.kr' || !match) return null;
    return { url, type: 'paju', channel: match[1] };
  }
  if (entry.providerType === 'muju') {
    const match = /^\/mujuresort\/_definst_\/cam(0[1-9]|1[01])\.stream\/playlist\.m3u8$/.exec(url.pathname);
    // Pin the literal canonical URL too: URL normalization must not admit an
    // alternate authority, port, encoding, whitespace or dot-segment spelling.
    if (!match || entry.streamUrl !== hlsMujuOrigin + url.pathname) return null;
    return { url, type: 'muju', channel: match[1] };
  }
  return null;
}

function hlsAllowedPath(source, pathname) {
  // Percent-encoding is decoded once by URLSearchParams. Reject nested encoding,
  // traversal, backslashes, query strings and URL authority syntax thereafter.
  if (typeof pathname !== 'string' || !/^\/[A-Za-z0-9_./-]+$/.test(pathname) || pathname.includes('..') || pathname.includes('//') || /(?:^|\/)\.(?:\/|$)/.test(pathname)) return false;
  // Muju's unsigned master is catalog identity only. A new index connection
  // must obtain its own short-lived URL from the ordinary public popup.
  if (pathname === source.url.pathname) return !['muju', 'cheongju'].includes(source.type);
  if (source.type === 'yeongsan') return new RegExp('^/live/cctv' + source.channel + '/\\d{4}-\\d{2}-\\d{2}/\\d{2}/\\d{2}-\\d{2}_\\d+\\.ts$').test(pathname);
  if (source.type === 'jeju') return /^\/media\/api\/v1\/ts\/[a-f0-9]{64}_\d+$/.test(pathname);
  if (source.type === 'cheongju') return new RegExp('^/' + source.channel + '/(?:[1-9][0-9]{2,3}p\\.m3u8|ts_[1-9][0-9]{2,3}p_\\d{16}\\.ts)$').test(pathname);
  if (source.type === 'paju') return new RegExp('^/live/cctv_' + source.channel + '\\.stream/(?:chunklist_w\\d+\\.m3u8|media_w\\d+_\\d+\\.ts)$').test(pathname);
  if (source.type === 'high1') return new RegExp('^/live/ch' + source.channel + '\\.stream/(?:chunklist_w\\d+\\.m3u8|media_w\\d+_\\d+\\.ts)$').test(pathname);
  if (source.type === 'muju') return new RegExp('^/mujuresort/_definst_/cam' + source.channel + '\\.stream/(?:chunklist_w\\d+\\.m3u8|media_w\\d+_\\d+\\.ts)$').test(pathname);
  return new RegExp('^/rscFiles/POSTDATA/CCTV/' + source.channel + '/' + source.channel + '_stream\\d+\\.ts$').test(pathname);
}

function hlsRewriteManifest(text, source, upstreamUrl, id) {
  const lines = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').split('\n');
  if (lines[0] !== '#EXTM3U') throw new HlsRelayFailure(502, 'INVALID_MANIFEST');
  let mediaUris = 0;
  function rewrite(uri) {
    if (!uri || /[%\\\s?#]/.test(uri) || /(?:^|\/)\.{1,2}(?:\/|$)/.test(uri)) throw new HlsRelayFailure(502, 'UNSAFE_MANIFEST_URI');
    let target;
    try { target = new URL(uri, upstreamUrl); } catch { throw new HlsRelayFailure(502, 'UNSAFE_MANIFEST_URI'); }
    if (target.origin !== source.url.origin || target.username || target.password || target.search || target.hash || !hlsAllowedPath(source, target.pathname)) throw new HlsRelayFailure(502, 'UNSAFE_MANIFEST_URI');
    return '/api/hls/' + id + '/resource?path=' + encodeURIComponent(target.pathname);
  }
  const result = lines.map(line => {
    if (!line.trim()) return '';
    if (!line.startsWith('#')) { mediaUris++; return rewrite(line.trim()); }
    // Current public catalogs are unencrypted. Never introduce a key relay or
    // honor unobserved URI-bearing extensions such as content steering.
    if (/^#EXT-X-(?:KEY|SESSION-KEY|CONTENT-STEERING):/.test(line)) throw new HlsRelayFailure(502, 'UNSUPPORTED_MANIFEST');
    if (/\bURI\s*=/.test(line)) {
      let count = 0;
      const rewritten = line.replace(/\bURI="([^"\r\n]+)"/g, (_match, uri) => { count++; return 'URI="' + rewrite(uri) + '"'; });
      if (!count) throw new HlsRelayFailure(502, 'INVALID_MANIFEST');
      return rewritten;
    }
    return line;
  });
  if (!mediaUris || !lines.some(line => /^#EXT(?:INF|-X-STREAM-INF):/.test(line))) throw new HlsRelayFailure(502, 'INVALID_MANIFEST');
  return result.join('\n');
}

function hlsCancel(response) { try { response.body?.cancel().catch(() => {}); } catch {} }

function hlsMujuPublicMedia(html, source) {
  const tags = html.match(/<source\b[^>]*>/gi) || [];
  if (tags.length !== 1 || (tags[0].match(/\ssrc\s*=/gi) || []).length !== 1) throw new HlsRelayFailure(502, 'PUBLIC_HLS_UNAVAILABLE');
  const field = /\ssrc\s*=\s*(["'])([^"'<>]+)\1/i.exec(tags[0]);
  if (!field) throw new HlsRelayFailure(502, 'PUBLIC_HLS_UNAVAILABLE');
  // Only the HTML ampersand spelling is normalized. URL escapes, arbitrary
  // entities, extra query fields and duplicate e/h values remain invalid.
  const raw = field[2].replace(/&amp;/g, '&');
  let media;
  try { media = new URL(raw); } catch { throw new HlsRelayFailure(502, 'UNEXPECTED_PUBLIC_MEDIA'); }
  if (media.origin !== source.url.origin || media.pathname !== source.url.pathname ||
      raw !== source.url.href + media.search ||
      !/^\?(?:e=\d{10}&h=[A-Fa-f0-9]{32}|h=[A-Fa-f0-9]{32}&e=\d{10})$/.test(media.search)) {
    throw new HlsRelayFailure(502, 'UNEXPECTED_PUBLIC_MEDIA');
  }
  const expiresAt = Number(media.searchParams.get('e')) * 1000;
  if (expiresAt <= Date.now()) throw new HlsRelayFailure(502, 'PUBLIC_MEDIA_EXPIRED');
  return { url: media.href, expiresAt, signature: media.searchParams.get('h') };
}

// Muju's published player issues an ephemeral signed HTTP master. Fetch that
// same popup once per connection, then relay the master instead of redirecting
// an HTTPS viewer to HTTP. Its observed child playlists and TS are query-free.
// No signed URL is cached, stored in the catalog, retried or sent to the client.
async function hlsMujuConnection(request, source, id, fetchImpl) {
  const controller = new AbortController();
  let timer;
  const read = async (url, limit, accept) => {
    if (controller.signal.aborted) throw new HlsRelayFailure(504, 'UPSTREAM_TIMEOUT');
    const response = await fetchImpl(url, { method: 'GET', redirect: 'manual', credentials: 'omit', signal: controller.signal, headers: { Accept: accept } });
    // A fetch implementation may settle after the deadline despite abort.
    if (controller.signal.aborted) { hlsCancel(response); throw new HlsRelayFailure(504, 'UPSTREAM_TIMEOUT'); }
    return new TextDecoder('utf-8', { fatal: true }).decode(await hlsRead(response, controller.signal, limit));
  };
  try {
    const deadline = new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new HlsRelayFailure(504, 'UPSTREAM_TIMEOUT')); }, hlsManifestDeadlineMs); });
    const operation = (async () => {
      const html = await read('http://www.mdysresort.com/guide/webcam_popup_jh.asp?cam_num=' + source.channel, 200_000, 'text/html');
      const media = hlsMujuPublicMedia(html, source);
      const manifest = await read(media.url, hlsManifestLimit, 'application/vnd.apple.mpegurl, application/x-mpegURL, text/plain');
      if (media.expiresAt <= Date.now()) throw new HlsRelayFailure(502, 'PUBLIC_MEDIA_EXPIRED');
      // Even an unexpected comment/metadata echo must not expose the transient
      // signature in the client playlist. The published child URIs omit it.
      if (manifest.includes(media.signature)) throw new HlsRelayFailure(502, 'UNEXPECTED_PUBLIC_MEDIA');
      return new TextEncoder().encode(hlsRewriteManifest(manifest, source, media.url, id));
    })();
    const body = await Promise.race([operation, deadline]);
    return new Response(request.method === 'HEAD' ? null : body, { status: 200, headers: { 'Content-Type': 'application/vnd.apple.mpegurl', 'Content-Length': String(body.byteLength), 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
  } catch (error) {
    return hlsError(request, error instanceof HlsRelayFailure ? error.status : 502, error instanceof HlsRelayFailure ? error.code : 'PUBLIC_CONNECTION_FAILED');
  } finally { clearTimeout(timer); }
}

// Some public providers start a camera or issue a short-lived view URL from
// their public player. Repeat that published flow on each user connection;
// never store a session URL in the catalog or reuse another application's key.
async function hlsPublicConnection(request, entry, fetchImpl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  const read = async (url, limit) => {
    const response = await fetchImpl(url, { method: 'GET', redirect: 'manual', credentials: 'omit', signal: controller.signal, headers: { Accept: 'text/html, text/plain' } });
    return new TextDecoder('utf-8', { fatal: true }).decode(await hlsRead(response, controller.signal, limit));
  };
  try {
    let destination;
    if (entry.providerType === 'gits') {
      const source = new URL(entry.streamUrl);
      const id = source.searchParams.get('cctvId');
      if (!/^\d{1,8}$/.test(id || '') || source.href !== 'https://gits.gg.go.kr/web/popup/webCctvPopup.do?cctvId=' + id) throw new HlsRelayFailure(404, 'UNSUPPORTED_SOURCE');
      const html = await read(source.href, 200_000);
      const match = html.match(/\$\.get\(\s*["']((?:https?:)?\/\/gitsview\.gg\.go\.kr\/\d+\/[^"'\s]+!hls)["']/);
      if (!match) throw new HlsRelayFailure(502, 'PUBLIC_HLS_UNAVAILABLE');
      const resolver = new URL(match[1].startsWith('//') ? 'https:' + match[1] : match[1]);
      if (resolver.origin !== 'https://gitsview.gg.go.kr' || resolver.username || resolver.password || resolver.hash || resolver.search || !resolver.pathname.startsWith('/' + id + '/') || /[%\\]/.test(resolver.pathname)) throw new HlsRelayFailure(502, 'UNEXPECTED_PUBLIC_RESOLVER');
      const resolved = (await read(resolver.href, 4096)).trim();
      const media = new URL(resolved);
      if (media.origin !== 'https://cctvsec.ktict.co.kr:8082' || media.username || media.password || media.hash || !/^\/(?:(?:gyeonggi\d+\/gyeonggi\d+[A-Za-z]?|koroad\d+\/L\d+|sisul\d+\/sisul\d+[A-Za-z]?|gits\d+\/gits\d+[A-Za-z]?|mgmt\d+\/mgmtcctv\d+[A-Za-z]?|utic\d+\/utic\d+[A-Za-z]?|ex\d+\/ex[A-Za-z0-9]+)\/playlist\.m3u8|mstrm\d+hls\/[A-Fa-f0-9]{32}\/live\/[A-Za-z0-9]+\/\d{3}\/visumy\.m3u8)$/.test(media.pathname)) throw new HlsRelayFailure(502, 'UNEXPECTED_PUBLIC_MEDIA');
      destination = media.href;
    } else if (entry.providerType === 'yeongsan') {
      const source = new URL(entry.streamUrl);
      const match = /^\/live\/cctv(\d{5,6})\/hls\.m3u8$/.exec(source.pathname);
      if (source.origin !== 'https://cctvlo.yeongsanriver.go.kr' || !match || source.search || source.hash || source.username || source.password) throw new HlsRelayFailure(404, 'UNSUPPORTED_SOURCE');
      const html = await read('https://www.yeongsanriver.go.kr/sumun/videoDetail.do?wlobscd=' + match[1], 200_000);
      const field = html.match(/<input\b[^>]*\bid=["']vi_link_ssl["'][^>]*\bvalue=["']([^"']+)["']/i);
      if (!field || field[1] !== source.href) throw new HlsRelayFailure(502, 'PUBLIC_CAMERA_MISMATCH');
      const cameraId = /^\/api\/hls\/([a-z0-9_-]+)\/index\.m3u8$/.exec(new URL(request.url).pathname)?.[1];
      if (!cameraId) throw new HlsRelayFailure(404, 'UNSUPPORTED_SOURCE');
      destination = '/api/hls/' + cameraId + '/resource?path=' + encodeURIComponent(source.pathname);
    } else throw new HlsRelayFailure(404, 'UNSUPPORTED_SOURCE');
    return new Response(null, { status: 302, headers: { Location: destination, 'Cache-Control': 'no-store', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'X-Content-Type-Options': 'nosniff' } });
  } catch (error) {
    return hlsError(request, controller.signal.aborted ? 504 : error instanceof HlsRelayFailure ? error.status : 502, controller.signal.aborted ? 'UPSTREAM_TIMEOUT' : error instanceof HlsRelayFailure ? error.code : 'PUBLIC_CONNECTION_FAILED');
  } finally { clearTimeout(timer); }
}

async function hlsRead(response, signal, limit) {
  if (response.redirected || (response.status >= 300 && response.status < 400)) { hlsCancel(response); throw new HlsRelayFailure(502, 'UPSTREAM_REDIRECT'); }
  if (response.status !== 200) { hlsCancel(response); throw new HlsRelayFailure(502, 'UPSTREAM_STATUS'); }
  const size = response.headers.get('Content-Length');
  if (size && /^\d+$/.test(size) && Number(size) > limit) { hlsCancel(response); throw new HlsRelayFailure(502, 'UPSTREAM_TOO_LARGE'); }
  if (!response.body) throw new HlsRelayFailure(502, 'EMPTY_UPSTREAM');
  const reader = response.body.getReader();
  const chunks = [];
  let length = 0;
  const cancel = () => { reader.cancel().catch(() => {}); };
  signal.addEventListener('abort', cancel, { once: true });
  try {
    for (;;) {
      if (signal.aborted) throw new HlsRelayFailure(504, 'UPSTREAM_TIMEOUT');
      const { value, done } = await reader.read();
      if (signal.aborted) throw new HlsRelayFailure(504, 'UPSTREAM_TIMEOUT');
      if (done) break;
      length += value.byteLength;
      if (length > limit) { cancel(); throw new HlsRelayFailure(502, 'UPSTREAM_TOO_LARGE'); }
      chunks.push(value);
    }
  } finally { signal.removeEventListener('abort', cancel); reader.releaseLock(); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

async function hlsSegmentResponse(request, fetchUrl, fetchImpl) {
  const upstreamController = new AbortController();
  let reader = null, downstream = null, timer = null, finished = false;
  let failure = null, totalBytes = 0, declaredLength = null, rejectDeadline;
  const deadline = new Promise((_, reject) => { rejectDeadline = reject; });
  const release = () => { try { reader?.releaseLock(); } catch {} };
  const clearTimer = () => { clearTimeout(timer); timer = null; };
  function fail(error) {
    if (finished) return;
    finished = true; failure = error; clearTimer();
    upstreamController.abort(error);
    if (reader) reader.cancel(error).catch(() => {}).finally(release);
    if (downstream) { try { downstream.error(error); } catch {} }
    rejectDeadline(error);
  }
  function complete() { finished = true; clearTimer(); release(); }
  function count(chunk) {
    totalBytes += chunk.byteLength;
    if (totalBytes > hlsSegmentLimit) throw new HlsRelayFailure(502, 'UPSTREAM_TOO_LARGE');
    if (declaredLength !== null && totalBytes > declaredLength) throw new HlsRelayFailure(502, 'UPSTREAM_LENGTH_MISMATCH');
  }
  function checkEnd() {
    if (declaredLength !== null && totalBytes !== declaredLength) throw new HlsRelayFailure(502, 'UPSTREAM_LENGTH_MISMATCH');
  }
  timer = setTimeout(() => fail(new HlsRelayFailure(504, 'UPSTREAM_TIMEOUT')), hlsSegmentDeadlineMs);
  try {
    const prepare = (async () => {
      const response = await fetchImpl(fetchUrl, { method: 'GET', redirect: 'manual', signal: upstreamController.signal, headers: { Accept: 'video/mp2t, application/octet-stream' } });
      if (finished) { hlsCancel(response); throw failure; }
      if (response.redirected || (response.status >= 300 && response.status < 400)) { hlsCancel(response); throw new HlsRelayFailure(502, 'UPSTREAM_REDIRECT'); }
      if (response.status !== 200) { hlsCancel(response); throw new HlsRelayFailure(502, 'UPSTREAM_STATUS'); }
      const size = response.headers.get('Content-Length');
      if (size && /^\d+$/.test(size)) {
        declaredLength = Number(size);
        if (declaredLength > hlsSegmentLimit) { hlsCancel(response); throw new HlsRelayFailure(502, 'UPSTREAM_TOO_LARGE'); }
      }
      if (!response.body) throw new HlsRelayFailure(502, 'EMPTY_UPSTREAM');
      reader = response.body.getReader();
      const prefix = new Uint8Array(377), queued = [];
      let prefixBytes = 0;
      while (prefixBytes < prefix.length) {
        const { value, done } = await reader.read();
        if (finished) throw failure;
        if (done) throw new HlsRelayFailure(502, 'INVALID_SEGMENT');
        count(value);
        const take = Math.min(value.byteLength, prefix.length - prefixBytes);
        prefix.set(value.subarray(0, take), prefixBytes); prefixBytes += take;
        if (value.byteLength) queued.push(value);
      }
      if (prefix[0] !== 0x47 || prefix[188] !== 0x47 || prefix[376] !== 0x47) throw new HlsRelayFailure(502, 'INVALID_SEGMENT');
      const headers = { 'Content-Type': 'video/mp2t', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
      if (request.method === 'HEAD') {
        // HEAD has no progressive body; consume and validate within the same
        // deadline so headers never certify a truncated/oversized segment.
        for (;;) {
          const { value, done } = await reader.read();
          if (finished) throw failure;
          if (done) break;
          count(value);
        }
        checkEnd(); headers['Content-Length'] = String(totalBytes); complete();
        return new Response(null, { status: 200, headers });
      }
      if (declaredLength !== null) headers['Content-Length'] = String(declaredLength);
      const body = new ReadableStream({
        start(controller) { downstream = controller; },
        async pull(controller) {
          if (finished) return;
          try {
            if (queued.length) { controller.enqueue(queued.shift()); return; }
            const { value, done } = await reader.read();
            if (finished) return;
            if (done) { checkEnd(); complete(); controller.close(); return; }
            count(value);
            if (value.byteLength) controller.enqueue(value);
          } catch (error) { fail(error); }
        },
        cancel(reason) {
          if (finished) return;
          finished = true; clearTimer(); upstreamController.abort(reason);
          return reader.cancel(reason).catch(() => {}).finally(release);
        }
      }, { highWaterMark: 0 });
      return new Response(body, { status: 200, headers });
    })();
    // This race only controls preparation. After headers, fail() errors the
    // stream directly instead of inventing a new HTTP status for that response.
    return await Promise.race([prepare, deadline]);
  } catch (error) {
    fail(error);
    return hlsError(request, error instanceof HlsRelayFailure ? error.status : 502, error instanceof HlsRelayFailure ? error.code : 'UPSTREAM_FETCH_FAILED');
  }
}

/** Build injects HLS_CATALOG; tests may pass a separate catalog object. */
export async function handleHls(request, { fetchImpl = fetch, catalog = typeof HLS_CATALOG === 'undefined' ? {} : HLS_CATALOG } = {}) {
  if (!['GET', 'HEAD'].includes(request.method)) return hlsError(request, 405, 'METHOD_NOT_ALLOWED', { Allow: 'GET, HEAD' });
  const url = new URL(request.url);
  const match = /^\/api\/hls\/([a-z0-9][a-z0-9_-]{0,79})\/(index\.m3u8|resource)$/.exec(url.pathname);
  if (!match || !Object.prototype.hasOwnProperty.call(catalog, match[1])) return hlsError(request, 404, 'UNKNOWN_CAMERA');
  const entry = catalog[match[1]];
  if (entry.providerType === 'gits' || (entry.providerType === 'yeongsan' && match[2] === 'index.m3u8')) {
    if (match[2] !== 'index.m3u8' || url.search) return hlsError(request, 400, 'INVALID_PUBLIC_CONNECTION');
    return hlsPublicConnection(request, entry, fetchImpl);
  }
  const id = match[1], source = hlsSource(catalog[id], id);
  if (!source) return hlsError(request, 404, 'UNSUPPORTED_SOURCE');
  let pathname = source.url.pathname;
  if (match[2] === 'index.m3u8') {
    if (url.search) return hlsError(request, 400, 'QUERY_NOT_ALLOWED');
    if (source.type === 'muju') return hlsMujuConnection(request, source, id, fetchImpl);
  } else {
    if ([...url.searchParams].length !== 1 || !url.searchParams.has('path')) return hlsError(request, 400, 'INVALID_RESOURCE');
    pathname = url.searchParams.get('path');
    if (!hlsAllowedPath(source, pathname)) return hlsError(request, 400, 'INVALID_RESOURCE');
  }
  const upstreamUrl = source.url.origin + pathname;
  const fetchUrl = (hlsTransportOrigins[source.type] || source.url.origin) + pathname;
  const isManifest = pathname === source.url.pathname || (['high1', 'muju', 'cheongju', 'paju'].includes(source.type) && pathname.endsWith('.m3u8'));
  if (!isManifest) return hlsSegmentResponse(request, fetchUrl, fetchImpl);
  const controller = new AbortController();
  let timer;
  try {
    const operation = (async () => {
      const response = await fetchImpl(fetchUrl, { method: 'GET', redirect: 'manual', signal: controller.signal, headers: { Accept: 'application/vnd.apple.mpegurl, application/x-mpegURL, text/plain' } });
      const bytes = await hlsRead(response, controller.signal, hlsManifestLimit);
      let text;
      try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { throw new HlsRelayFailure(502, 'INVALID_MANIFEST'); }
      return { body: new TextEncoder().encode(hlsRewriteManifest(text, source, upstreamUrl, id)), type: 'application/vnd.apple.mpegurl' };
    })();
    const deadline = new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new HlsRelayFailure(504, 'UPSTREAM_TIMEOUT')); }, hlsManifestDeadlineMs); });
    const result = await Promise.race([operation, deadline]);
    // Jeju exposes only a few one-second fragments: never cache its playlist.
    return new Response(request.method === 'HEAD' ? null : result.body, { status: 200, headers: { 'Content-Type': result.type, 'Content-Length': String(result.body.byteLength), 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
  } catch (error) {
    return hlsError(request, error instanceof HlsRelayFailure ? error.status : 502, error instanceof HlsRelayFailure ? error.code : 'UPSTREAM_FETCH_FAILED');
  } finally { clearTimeout(timer); }
}
