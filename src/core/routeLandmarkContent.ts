export type RouteLandmarkKind = "pass" | "ferry" | "post" | "fort" | "market" | "temple";

export interface RouteLandmark {
  id: string;
  routeId: string;
  progress: number;
  kind: RouteLandmarkKind;
  name: string;
  description: string;
  service: string;
  prominence: "major" | "local";
}

export const ROUTE_LANDMARK_KIND: Record<RouteLandmarkKind, { seal: string; label: string }> = {
  pass: { seal: "关", label: "关隘" },
  ferry: { seal: "渡", label: "渡口" },
  post: { seal: "驿", label: "驿亭" },
  fort: { seal: "寨", label: "寨堡" },
  market: { seal: "市", label: "路市" },
  temple: { seal: "祠", label: "祠寺" },
};

/**
 * Named road sites are deliberately attached to the existing route graph rather
 * than stored as free-floating map coordinates. This keeps their geography,
 * route intelligence and stopover copy in agreement even when the painted map
 * or its projection changes.
 */
export const ROUTE_LANDMARKS: readonly RouteLandmark[] = [
  { id: "juyong-post", routeId: "yanjing-datong", progress: .27, kind: "post", name: "居庸驿", prominence: "major", service: "换马验牒", description: "燕山谷口的官驿扼住西行驿路，关前常有军骑与商队交错。" },
  { id: "yanmen-pass", routeId: "datong-taiyuan", progress: .55, kind: "pass", name: "雁门关", prominence: "major", service: "验牒候关", description: "雁门山势收束南北道路，风口急、盘查也严，是河东路最醒目的关门。" },
  { id: "jingxing-pass", routeId: "zhending-taiyuan", progress: .55, kind: "pass", name: "井陉关", prominence: "major", service: "雇向导", description: "太行八陉之一，石径夹山而行，熟路脚夫比快马更可靠。" },
  { id: "hulao-post", routeId: "kaifeng-luoyang", progress: .62, kind: "post", name: "虎牢驿", prominence: "local", service: "换马投宿", description: "汴洛往来的车马在古关旁换脚，驿亭里消息来得比官报更快。" },
  { id: "hangu-pass", routeId: "luoyang-hezhong", progress: .48, kind: "pass", name: "函谷故关", prominence: "major", service: "雇夫护车", description: "崤函地势逼仄，旧关虽改，道口仍是西行车队清点绳索的地方。" },
  { id: "tong-pass", routeId: "hezhong-jingzhao", progress: .46, kind: "pass", name: "潼关", prominence: "major", service: "验牒补粮", description: "黄河与华山夹出一线关门，关中东路的人货都要在这里留下文牒。" },
  { id: "long-pass-post", routeId: "lanzhou-jingzhao", progress: .58, kind: "post", name: "陇关驿", prominence: "local", service: "换马问路", description: "陇坂长道上的换马处，驮队常在此重扎货绳、打听前方烽火。" },
  { id: "shandan-post", routeId: "liangzhou-ganzhou", progress: .55, kind: "post", name: "山丹驿", prominence: "major", service: "饮马补水", description: "河西廊道上的大驿，泉井、草料与驼队牙人都聚在驿墙内外。" },
  { id: "huanghe-gorge-post", routeId: "lingzhou-lanzhou", progress: .46, kind: "post", name: "黄河峡驿", prominence: "local", service: "补水候风", description: "峡道临河，行旅要看水势与风口，驿卒最熟哪段栈路刚被冲坏。" },
  { id: "baoxie-stockade", routeId: "jingzhao-xingyuan", progress: .57, kind: "fort", name: "褒斜栈口", prominence: "major", service: "雇夫修具", description: "秦岭栈道在谷口收紧，守栈铺兵与木匠都能看出一辆车是否撑得过山。" },
  { id: "wusheng-pass", routeId: "kaifeng-xiangyang", progress: .66, kind: "pass", name: "武胜关", prominence: "major", service: "验牒探路", description: "南北军路在山隘间穿行，旗号、路引和口音都会被守关人多问一句。" },
  { id: "hengjiang-ferry", routeId: "hezhou-jiankang", progress: .48, kind: "ferry", name: "横江浦", prominence: "major", service: "雇舟系车", description: "江面宽急，渡船要把车马分批摆渡，老艄公能凭云脚判断几时起浪。" },
  { id: "guazhou-ferry", routeId: "yangzhou-zhenjiang", progress: .5, kind: "ferry", name: "瓜洲渡", prominence: "major", service: "候潮过江", description: "运河入江处舟楫密集，昼夜都有渡船，却也最容易因军令突然封津。" },
  { id: "longtan-post", routeId: "zhenjiang-jiankang", progress: .48, kind: "post", name: "龙潭驿", prominence: "local", service: "换舟投宿", description: "沿江驿亭接应京口与建康来船，夜里仍能找到热汤与干燥草料。" },
  { id: "guangde-post", routeId: "linan-jiankang", progress: .44, kind: "post", name: "广德军驿", prominence: "major", service: "换马递文", description: "行在通往建康的长驿路在广德军换马递文，南来北往的急报多在此交手。" },
  { id: "danyang-post", routeId: "jiankang-pingjiang", progress: .35, kind: "post", name: "丹阳驿", prominence: "local", service: "换马投宿", description: "江南东路出建康后在丹阳换脚，驿舍熟悉往平江府去的水陆两程。" },
  { id: "wujiang-post", routeId: "pingjiang-jiaxing", progress: .52, kind: "post", name: "吴江驿", prominence: "local", service: "换舟过塘", description: "太湖东南水网在吴江收束，舟车常在塘桥旁重新编队。" },
  { id: "linping-post", routeId: "jiaxing-linan", progress: .58, kind: "post", name: "临平驿", prominence: "major", service: "换舟递信", description: "水网入行在前的最后一处大驿，官船、商舟与递铺文书在此汇流。" },
  { id: "qiantang-ferry", routeId: "linan-shaoxing", progress: .48, kind: "ferry", name: "钱塘渡", prominence: "major", service: "候潮渡车", description: "江潮来去有时，车马必须听从渡头旗语，抢潮只会把整队人货困在江心。" },
  { id: "caoe-market", routeId: "shaoxing-qingyuan", progress: .43, kind: "market", name: "曹娥埭", prominence: "local", service: "添粮雇舟", description: "浙东水路的埭市靠搬运与换舟兴旺，脚夫、船户和米行终日不歇。" },
  { id: "caishi-ferry", routeId: "jiankang-jiangzhou", progress: .25, kind: "ferry", name: "采石矶", prominence: "major", service: "问水势", description: "石矶临江，既是渡头也是兵家注目的江防要处，过往船只都格外谨慎。" },
  { id: "chizhou-ferry", routeId: "jiankang-ezhou", progress: .43, kind: "ferry", name: "池州渡", prominence: "local", service: "换舟候风", description: "长江西航在池州一带补水换舟，逆风时商船会靠岸等一夜江风。" },
  { id: "fuchi-ferry", routeId: "ezhou-jiangzhou", progress: .46, kind: "ferry", name: "富池口", prominence: "local", service: "结伴过江", description: "鄂赣江路的江口水势交错，小船往往在这里结伴再走。" },
  { id: "hukou-ferry", routeId: "jiangzhou-raozhou", progress: .48, kind: "ferry", name: "湖口渡", prominence: "major", service: "换舟避风", description: "江湖交汇处水色与风向骤变，熟悉湖口的舟子能替镖船避开回流。" },
  { id: "jingmen-post", routeId: "xiangyang-jiangling", progress: .58, kind: "post", name: "荆门驿", prominence: "major", service: "换马核报", description: "荆襄官道南下的驿铺，北来的军情与江陵商报常在这里碰头。" },
  { id: "hanjin-ferry", routeId: "xiangyang-ezhou", progress: .58, kind: "ferry", name: "汉津渡", prominence: "major", service: "换舟探水", description: "汉水南航的津渡为长程船队换梢公，也把襄鄂两地的水情递给北上行旅。" },
  { id: "yiling-gorge", routeId: "jiangling-kuizhou", progress: .28, kind: "pass", name: "夷陵峡口", prominence: "major", service: "雇梢公", description: "江面从平阔忽入峡束，换熟悉滩声的梢公比添十名护卫更要紧。" },
  { id: "baidi-gorge", routeId: "kuizhou-chongqing", progress: .2, kind: "fort", name: "白帝峡口", prominence: "major", service: "候水结伴", description: "峡门城寨俯看急流，船队常在此结伴，等水势合宜才一同上航。" },
  { id: "jinniu-post", routeId: "chengdu-lizhou", progress: .55, kind: "post", name: "金牛驿", prominence: "major", service: "换骡修车", description: "蜀道北上的大驿，骡夫、木匠与山货牙人都懂得怎样把重车送进群山。" },
  { id: "jianmen-pass", routeId: "lizhou-xingyuan", progress: .34, kind: "pass", name: "剑门关", prominence: "major", service: "验牒候关", description: "两山如门，栈道只容车马次第而过，前后拥堵时尤其容易生事。" },
  { id: "maozhou-fort", routeId: "songpan-chengdu", progress: .48, kind: "fort", name: "茂州寨", prominence: "local", service: "雇番客向导", description: "岷山古道的寨市汇集羌汉商旅，向导会先问雪线，再谈脚价。" },
  { id: "daiyun-stockade", routeId: "quanzhou-jianning", progress: .48, kind: "fort", name: "戴云山寨", prominence: "local", service: "投宿雇夫", description: "山民在岭腰设寨接应挑夫，茶盐与海货会在这里改由肩担转运。" },
  { id: "xianxia-pass", routeId: "jianning-wuzhou", progress: .56, kind: "pass", name: "仙霞关", prominence: "major", service: "验牒雇夫", description: "闽浙山路穿关而过，坡陡弯急，守关铺兵会细看车辙与货封。" },
  { id: "boping-stockade", routeId: "tingzhou-zhangzhou", progress: .5, kind: "fort", name: "博平岭寨", prominence: "local", service: "添粮问路", description: "岭上小寨接济汀漳挑夫，雨后哪条石径能走，只有本地人说得准。" },
  { id: "mei-pass", routeId: "ganzhou-shaozhou", progress: .48, kind: "pass", name: "梅关", prominence: "major", service: "换夫通关", description: "大庾岭上的南北门户，梅花路旁脚店成行，也是货物换挑夫的地方。" },
  { id: "lingqu-market", routeId: "hengzhou-jingjiang", progress: .72, kind: "market", name: "灵渠驿市", prominence: "major", service: "换舟添粮", description: "湘桂之间水陆换运的驿市，船户与挑夫能把同一批货接力送往岭南。" },
  { id: "wumeng-caravan", routeId: "dali-chengdu", progress: .48, kind: "fort", name: "乌蒙马帮寨", prominence: "local", service: "换马结伴", description: "茶马古道上的山寨为长程马帮挡风守夜，独行车队往往在此等伴。" },
  { id: "tangfan-post", routeId: "qingtang-lhasa", progress: .45, kind: "post", name: "唐蕃古驿", prominence: "local", service: "换牦牛向导", description: "高原驼道旁残存的古驿仍为商旅辨路，风雪里要靠石堆与经幡认方向。" },
];

export function routeLandmarkKind(kind: RouteLandmarkKind) {
  return ROUTE_LANDMARK_KIND[kind];
}

export function landmarksForRoute(routeId: string): RouteLandmark[] {
  return ROUTE_LANDMARKS.filter((landmark) => landmark.routeId === routeId).sort((a, b) => a.progress - b.progress);
}

export function primaryLandmarkForRoute(routeId: string): RouteLandmark | null {
  const landmarks = landmarksForRoute(routeId);
  return landmarks.find((landmark) => landmark.prominence === "major") ?? landmarks[0] ?? null;
}

export function landmarksForPlan(routeIds: readonly string[]): RouteLandmark[] {
  return routeIds.flatMap((routeId) => landmarksForRoute(routeId));
}
