export const OFFICIAL_SCRIPT_REFERENCE = {
  "tb": {
    "meta": {
      "name": "暗流涌动",
      "logo": "https://oss.gstonegames.com/static/image/team/202206/c_5935045915561_5940ef2d.jpg",
      "description": "乌云在鸦木布拉夫的天空中翻滚着，让这个沉睡中的小镇和迷信的居民们笼罩在不祥的阴影之中。刚洗过的衣物在屋舍间的细绳上诡异地起舞。烟囱向外吐出滚滚的浓烟。<br><br>坩埚在角落里悄悄地冒着泡，混杂着奇异的气味从窗户和门缝中飘散开来。一股不寻常的秋日暖风环绕着藤蔓覆盖的墙壁，向那些敢于行走在鹅卵石街道上的人们发出不祥的低语。<br><br>当远处的地平线上雷声响起时，焦虑的母亲们把玩耍中的孩子唤回家中。然而，如果你再仔细聆听，仍然可以听见近处森林里的诡异回声。远处一座隐约可见的修道院里，有人影在一道道门洞间穿行。<br><br>只有那些读懂迹象的人，才能明白，有什么正在……<br><br>暗流涌动。"
    },
    "roles": [
      {
        "id": "washerwoman",
        "name": "洗衣妇",
        "englishName": "Washerwoman",
        "category": "townsfolk",
        "team": "good",
        "ability": "在你的首个夜晚，你会得知两名玩家和一个镇民角色：这两名玩家之一是该角色。",
        "flavor": "",
        "firstNight": 32,
        "otherNight": 0,
        "firstNightReminder": "展示那个镇民角色标记。指向被你标记“镇民”和“错误”的两名玩家。",
        "otherNightReminder": "",
        "reminders": [
          "镇民",
          "错误"
        ],
        "remindersGlobal": []
      },
      {
        "id": "librarian",
        "name": "图书管理员",
        "englishName": "Librarian",
        "category": "townsfolk",
        "team": "good",
        "ability": "在你的首个夜晚，你会得知两名玩家和一个外来者角色：这两名玩家之一是该角色（或者你会得知没有外来者在场）。",
        "flavor": "",
        "firstNight": 33,
        "otherNight": 0,
        "firstNightReminder": "展示那个外来者角色标记。指向被你标记“外来者”和“错误”的两名玩家。",
        "otherNightReminder": "",
        "reminders": [
          "外来者",
          "错误"
        ],
        "remindersGlobal": []
      },
      {
        "id": "investigator",
        "name": "调查员",
        "englishName": "Investigator",
        "category": "townsfolk",
        "team": "good",
        "ability": "在你的首个夜晚，你会得知两名玩家和一个爪牙角色：这两名玩家之一是该角色（或者你会得知没有爪牙在场）。",
        "flavor": "",
        "firstNight": 34,
        "otherNight": 0,
        "firstNightReminder": "展示那个爪牙角色标记。指向被你标记“爪牙”和“错误”的两名玩家。",
        "otherNightReminder": "",
        "reminders": [
          "爪牙",
          "错误"
        ],
        "remindersGlobal": []
      },
      {
        "id": "chef",
        "name": "厨师",
        "englishName": "Chef",
        "category": "townsfolk",
        "team": "good",
        "ability": "在你的首个夜晚，你会得知场上邻座的邪恶玩家有多少对。",
        "flavor": "",
        "firstNight": 35,
        "otherNight": 0,
        "firstNightReminder": "给他展示数字手势来告诉他场上邻座邪恶玩家有多少对。",
        "otherNightReminder": "",
        "reminders": [],
        "remindersGlobal": []
      },
      {
        "id": "empath",
        "name": "共情者",
        "englishName": "Empath",
        "category": "townsfolk",
        "team": "good",
        "ability": "每个夜晚，你会得知与你邻近的两名存活的玩家中邪恶玩家的数量。",
        "flavor": "",
        "firstNight": 36,
        "otherNight": 53,
        "firstNightReminder": "给他展示数字手势来告诉他与他邻近的存活玩家有几人是邪恶的。",
        "otherNightReminder": "给他展示数字手势来告诉他与他邻近的存活玩家有几人是邪恶的。",
        "reminders": [],
        "remindersGlobal": []
      },
      {
        "id": "fortune-teller",
        "name": "占卜师",
        "englishName": "Fortune Teller",
        "category": "townsfolk",
        "team": "good",
        "ability": "每个夜晚，你要选择两名玩家：你会得知他们之中是否有恶魔。会有一名善良玩家始终被你的能力当作恶魔。",
        "flavor": "",
        "firstNight": 37,
        "otherNight": 54,
        "firstNightReminder": "让占卜师选择两名玩家。如果其中有恶魔或“干扰项”，点头示意，否则摇头。",
        "otherNightReminder": "让占卜师选择两名玩家。如果其中有恶魔或“干扰项”，点头示意，否则摇头。",
        "reminders": [
          "干扰项"
        ],
        "remindersGlobal": []
      },
      {
        "id": "undertaker",
        "name": "送葬者",
        "englishName": "Undertaker",
        "category": "townsfolk",
        "team": "good",
        "ability": "每个夜晚*，你会得知今天白天死于处决的玩家的角色。",
        "flavor": "",
        "firstNight": 0,
        "otherNight": 56,
        "firstNightReminder": "",
        "otherNightReminder": "如果有玩家今天白天死于处决，唤醒送葬者并对他展示那名玩家的角色标记。",
        "reminders": [
          "死于今日"
        ],
        "remindersGlobal": []
      },
      {
        "id": "monk",
        "name": "僧侣",
        "englishName": "Monk",
        "category": "townsfolk",
        "team": "good",
        "ability": "每个夜晚*，你要选择除你以外的一名玩家：当晚恶魔的负面能力对他无效。",
        "flavor": "",
        "firstNight": 0,
        "otherNight": 13,
        "firstNightReminder": "",
        "otherNightReminder": "让僧侣选择除自己外的一名玩家。标记那名玩家被保护。",
        "reminders": [
          "保护"
        ],
        "remindersGlobal": []
      },
      {
        "id": "ravenkeeper",
        "name": "守鸦人",
        "englishName": "Ravenkeeper",
        "category": "townsfolk",
        "team": "good",
        "ability": "如果你在夜晚死亡，你会被唤醒，然后你要选择一名玩家：你会得知他的角色。",
        "flavor": "",
        "firstNight": 0,
        "otherNight": 42,
        "firstNightReminder": "",
        "otherNightReminder": "如果守鸦人今晚死亡，唤醒他并让他选择一名玩家。对他展示那名玩家的角色标记。",
        "reminders": [],
        "remindersGlobal": []
      },
      {
        "id": "virgin",
        "name": "贞洁者",
        "englishName": "Virgin",
        "category": "townsfolk",
        "team": "good",
        "ability": "当你首次被提名时，如果提名你的玩家是镇民，他立刻被处决。",
        "flavor": "",
        "firstNight": 0,
        "otherNight": 0,
        "firstNightReminder": "",
        "otherNightReminder": "",
        "reminders": [
          "失去能力"
        ],
        "remindersGlobal": []
      },
      {
        "id": "slayer",
        "name": "猎手",
        "englishName": "Slayer",
        "category": "townsfolk",
        "team": "good",
        "ability": "每局游戏限一次，你可以在白天时公开选择一名玩家：如果他是恶魔，他死亡。",
        "flavor": "",
        "firstNight": 0,
        "otherNight": 0,
        "firstNightReminder": "",
        "otherNightReminder": "",
        "reminders": [
          "失去能力"
        ],
        "remindersGlobal": []
      },
      {
        "id": "soldier",
        "name": "士兵",
        "englishName": "Soldier",
        "category": "townsfolk",
        "team": "good",
        "ability": "恶魔的负面能力对你无效。",
        "flavor": "",
        "firstNight": 0,
        "otherNight": 0,
        "firstNightReminder": "",
        "otherNightReminder": "",
        "reminders": [],
        "remindersGlobal": []
      },
      {
        "id": "mayor",
        "name": "镇长",
        "englishName": "Mayor",
        "category": "townsfolk",
        "team": "good",
        "ability": "如果只有三名玩家存活且白天没有人被处决，你的阵营获胜。如果你在夜晚即将死亡，可能会有一名其他玩家代替你死亡。",
        "flavor": "",
        "firstNight": 0,
        "otherNight": 0,
        "firstNightReminder": "",
        "otherNightReminder": "",
        "reminders": [],
        "remindersGlobal": []
      },
      {
        "id": "butler",
        "name": "管家",
        "englishName": "Butler",
        "category": "outsider",
        "team": "good",
        "ability": "每个夜晚，你要选择除你以外的一名玩家：明天白天，只有他投票时你才能投票。",
        "flavor": "",
        "firstNight": 38,
        "otherNight": 55,
        "firstNightReminder": "让管家选择一名玩家。标记那名玩家为他的主人。",
        "otherNightReminder": "让管家选择一名玩家。标记那名玩家为他的主人。",
        "reminders": [
          "主人"
        ],
        "remindersGlobal": []
      },
      {
        "id": "drunk",
        "name": "酒鬼",
        "englishName": "Drunk",
        "category": "outsider",
        "team": "good",
        "ability": "你不知道你是酒鬼。你以为你是一个镇民角色，但其实你不是。",
        "flavor": "",
        "firstNight": 0,
        "otherNight": 0,
        "firstNightReminder": "",
        "otherNightReminder": "",
        "reminders": [],
        "remindersGlobal": [
          "是酒鬼"
        ]
      },
      {
        "id": "recluse",
        "name": "陌客",
        "englishName": "Recluse",
        "category": "outsider",
        "team": "good",
        "ability": "你可能会被当作邪恶阵营、爪牙角色或恶魔角色，即使你已死亡。",
        "flavor": "",
        "firstNight": 0,
        "otherNight": 0,
        "firstNightReminder": "",
        "otherNightReminder": "",
        "reminders": [],
        "remindersGlobal": []
      },
      {
        "id": "saint",
        "name": "圣徒",
        "englishName": "Saint",
        "category": "outsider",
        "team": "good",
        "ability": "如果你死于处决，你的阵营落败。",
        "flavor": "",
        "firstNight": 0,
        "otherNight": 0,
        "firstNightReminder": "",
        "otherNightReminder": "",
        "reminders": [],
        "remindersGlobal": []
      },
      {
        "id": "poisoner",
        "name": "投毒者",
        "englishName": "Poisoner",
        "category": "minion",
        "team": "evil",
        "ability": "每个夜晚，你要选择一名玩家：他在当晚和明天白天中毒。",
        "flavor": "",
        "firstNight": 17,
        "otherNight": 8,
        "firstNightReminder": "让投毒者选择一名玩家。标记那名玩家中毒。",
        "otherNightReminder": "让投毒者选择一名玩家。标记那名玩家中毒。",
        "reminders": [
          "中毒"
        ],
        "remindersGlobal": []
      },
      {
        "id": "spy",
        "name": "间谍",
        "englishName": "Spy",
        "category": "minion",
        "team": "evil",
        "ability": "每个夜晚，你能查看魔典。你可能会被当作善良阵营、镇民角色或外来者角色，即使你已死亡。",
        "flavor": "",
        "firstNight": 48,
        "otherNight": 68,
        "firstNightReminder": "将魔典展示给间谍，他想看多久就看多久。",
        "otherNightReminder": "将魔典展示给间谍，他想看多久就看多久。",
        "reminders": [],
        "remindersGlobal": []
      },
      {
        "id": "scarlet-woman",
        "name": "红唇女郎",
        "englishName": "Scarlet Woman",
        "category": "minion",
        "team": "evil",
        "ability": "如果大于等于五名玩家存活时（旅行者不计算在内）恶魔死亡，你变成那个恶魔。",
        "flavor": "",
        "firstNight": 0,
        "otherNight": 20,
        "firstNightReminder": "",
        "otherNightReminder": "如果红唇女郎今天变成了小恶魔，对她展示“你是”信息标记，和小恶魔角色标记。",
        "reminders": [],
        "remindersGlobal": [
          "是恶魔"
        ]
      },
      {
        "id": "baron",
        "name": "男爵",
        "englishName": "Baron",
        "category": "minion",
        "team": "evil",
        "ability": "会有额外的外来者在场。[+2 外来者]",
        "flavor": "",
        "firstNight": 0,
        "otherNight": 0,
        "firstNightReminder": "",
        "otherNightReminder": "",
        "reminders": [],
        "remindersGlobal": []
      },
      {
        "id": "imp",
        "name": "小恶魔",
        "englishName": "Imp",
        "category": "demon",
        "team": "evil",
        "ability": "每个夜晚*，你要选择一名玩家：他死亡。如果你以这种方式自杀，一名爪牙会变成小恶魔。",
        "flavor": "",
        "firstNight": 0,
        "otherNight": 24,
        "firstNightReminder": "",
        "otherNightReminder": "让小恶魔选择一名玩家。标记那名玩家死亡。如果小恶魔选择了自己：用一个备用的小恶魔标记替换一个存活的爪牙角色标记。让原来的小恶魔重新入睡。唤醒新的小恶魔。对他展示“你是”信息标记，和小恶魔角色标记。",
        "reminders": [
          "死亡"
        ],
        "remindersGlobal": []
      }
    ]
  },
  "bmr": {
    "meta": {
      "name": "黯月初升",
      "logo": "https://oss.gstonegames.com/static/image/team/202206/c_1745145915561_f3303786.jpg",
      "description": "冬日的暮色渐近，太阳被盘陀的天际线所吞噬，橙红的枫叶被黑色斑点逐渐侵蚀，森林无声地期待着雪花将至。<br><br>小镇边缘的岩隙深处传来阵阵饿狼的嚎叫，受惊的鸦群从舒适的栖身之处四散而逃。旅行者们匆匆步入旅店，试图回避渐增的刺骨寒意。众人靠着温热的茶水、悠扬的乐曲和浓烈的麦酒来暖和身子，却浑然不觉一双双怪异而邪恶的眼睛正向他们悄然逼近。<br><br>众生皆知，今夜将有……<br><br>黯月初升。"
    },
    "roles": [
      {
        "id": "grandmother",
        "name": "祖母",
        "englishName": "Grandmother",
        "category": "townsfolk",
        "team": "good",
        "ability": "在你的首个夜晚，你会得知一名善良玩家和他的角色。如果恶魔杀死了他，你也会死亡。",
        "flavor": "",
        "firstNight": 39,
        "otherNight": 50,
        "firstNightReminder": "指向她的孙子玩家，并展示该玩家的角色标记。",
        "otherNightReminder": "如果孙子被恶魔杀死，祖母也会一同死亡。标记祖母死亡。",
        "reminders": [
          "孙子",
          "死亡"
        ],
        "remindersGlobal": []
      },
      {
        "id": "sailor",
        "name": "水手",
        "englishName": "Sailor",
        "category": "townsfolk",
        "team": "good",
        "ability": "每个夜晚，你要选择一名存活的玩家：你或他之一会醉酒直到下个黄昏。你不会死亡。",
        "flavor": "",
        "firstNight": 10,
        "otherNight": 4,
        "firstNightReminder": "让水手选择一名存活玩家。标记那名玩家或水手醉酒。",
        "otherNightReminder": "让水手选择一名存活玩家。标记那名玩家或水手醉酒。",
        "reminders": [
          "醉酒"
        ],
        "remindersGlobal": []
      },
      {
        "id": "chambermaid",
        "name": "侍女",
        "englishName": "Chambermaid",
        "category": "townsfolk",
        "team": "good",
        "ability": "每个夜晚，你要选择除你以外的两名存活的玩家：你会得知他们中有几人在当晚因其自身能力而被唤醒。",
        "flavor": "",
        "firstNight": 50,
        "otherNight": 70,
        "firstNightReminder": "让侍女选择除自己外的两名存活玩家。给她展示数字手势来告诉她这些玩家中有几人因自身能力被唤醒。",
        "otherNightReminder": "让侍女选择除自己外的两名存活玩家。给她展示数字手势来告诉她这些玩家中有几人因自身能力被唤醒。",
        "reminders": [],
        "remindersGlobal": []
      },
      {
        "id": "exorcist",
        "name": "驱魔人",
        "englishName": "Exorcist",
        "category": "townsfolk",
        "team": "good",
        "ability": "每个夜晚*，你要选择一名玩家（与上个夜晚不同）：如果你选中了恶魔，他会得知你是驱魔人，但他当晚不会因其自身能力而被唤醒。",
        "flavor": "",
        "firstNight": 0,
        "otherNight": 22,
        "firstNightReminder": "",
        "otherNightReminder": "让驱魔人选择一名玩家，不能是上一夜他选择过的玩家。让驱魔人重新入睡。如果驱魔人选中了恶魔：唤醒恶魔。展示“该角色的能力对你生效”信息标记和驱魔人角色标记。指向驱魔人玩家。",
        "reminders": [
          "被选择"
        ],
        "remindersGlobal": []
      },
      {
        "id": "innkeeper",
        "name": "旅店老板",
        "englishName": "Innkeeper",
        "category": "townsfolk",
        "team": "good",
        "ability": "每个夜晚*，你要选择两名玩家：他们当晚不会死亡，但其中一人会醉酒到下个黄昏。",
        "flavor": "",
        "firstNight": 0,
        "otherNight": 9,
        "firstNightReminder": "",
        "otherNightReminder": "让旅店老板选择两名玩家。标记这两名玩家不会死亡，并标记其中一人醉酒。",
        "reminders": [
          "不会死亡",
          "醉酒"
        ],
        "remindersGlobal": []
      },
      {
        "id": "gambler",
        "name": "赌徒",
        "englishName": "Gambler",
        "category": "townsfolk",
        "team": "good",
        "ability": "每个夜晚*，你要选择一名玩家并猜测他的角色：如果你猜错了，你会死亡。",
        "flavor": "",
        "firstNight": 0,
        "otherNight": 11,
        "firstNightReminder": "",
        "otherNightReminder": "让赌徒选择一名玩家和一个角色。如果赌徒猜错了，标记赌徒死亡。",
        "reminders": [
          "死亡"
        ],
        "remindersGlobal": []
      },
      {
        "id": "gossip",
        "name": "造谣者",
        "englishName": "Gossip",
        "category": "townsfolk",
        "team": "good",
        "ability": "每个白天，你可以公开发表一个声明。如果该声明正确，在当晚会有一名玩家死亡。",
        "flavor": "",
        "firstNight": 0,
        "otherNight": 47,
        "firstNightReminder": "",
        "otherNightReminder": "如果白天的声明为真，会有一名玩家死亡，并由说书人来选择一名玩家，标记该玩家死亡。",
        "reminders": [
          "死亡"
        ],
        "remindersGlobal": []
      },
      {
        "id": "courtier",
        "name": "侍臣",
        "englishName": "Courtier",
        "category": "townsfolk",
        "team": "good",
        "ability": "每局游戏限一次，在夜晚时，你可以选择一个角色：如果该角色在场，该角色之一从当晚开始醉酒三天三夜。",
        "flavor": "",
        "firstNight": 19,
        "otherNight": 10,
        "firstNightReminder": "侍臣可以选择一个角色。如果他这么做了，标记侍臣失去能力，标记被选择的角色所对应的玩家醉酒。之后的夜晚无需再唤醒侍臣。",
        "otherNightReminder": "侍臣可以选择一个角色。如果他这么做了，标记侍臣失去能力，标记被选择的角色所对应的玩家醉酒。之后的夜晚无需再唤醒侍臣。",
        "reminders": [
          "醉酒1",
          "醉酒2",
          "醉酒3",
          "失去能力"
        ],
        "remindersGlobal": []
      },
      {
        "id": "professor",
        "name": "教授",
        "englishName": "Professor",
        "category": "townsfolk",
        "team": "good",
        "ability": "每局游戏限一次，在夜晚时*，你可以选择一名死亡的玩家：如果他是镇民，你会将他起死回生。",
        "flavor": "",
        "firstNight": 0,
        "otherNight": 45,
        "firstNightReminder": "",
        "otherNightReminder": "教授可以选择一名死亡玩家。如果他这么做了，标记教授失去能力，然后如果那名玩家是镇民，标记那名玩家被复活。之后的夜晚无需再唤醒教授。",
        "reminders": [
          "复活",
          "失去能力"
        ],
        "remindersGlobal": []
      },
      {
        "id": "minstrel",
        "name": "吟游诗人",
        "englishName": "Minstrel",
        "category": "townsfolk",
        "team": "good",
        "ability": "当一名爪牙死于处决时，除了你和旅行者以外的所有其他玩家醉酒直到明天黄昏。",
        "flavor": "",
        "firstNight": 0,
        "otherNight": 0,
        "firstNightReminder": "",
        "otherNightReminder": "",
        "reminders": [
          "全员醉酒"
        ],
        "remindersGlobal": []
      },
      {
        "id": "tea-lady",
        "name": "茶艺师",
        "englishName": "Tea Lady",
        "category": "townsfolk",
        "team": "good",
        "ability": "如果与你邻近的两名存活的玩家是善良的，他们不会死亡。",
        "flavor": "",
        "firstNight": 0,
        "otherNight": 0,
        "firstNightReminder": "",
        "otherNightReminder": "",
        "reminders": [
          "不会死亡"
        ],
        "remindersGlobal": []
      },
      {
        "id": "pacifist",
        "name": "和平主义者",
        "englishName": "Pacifist",
        "category": "townsfolk",
        "team": "good",
        "ability": "被处决的善良玩家可能不会死亡。",
        "flavor": "",
        "firstNight": 0,
        "otherNight": 0,
        "firstNightReminder": "",
        "otherNightReminder": "",
        "reminders": [],
        "remindersGlobal": []
      },
      {
        "id": "fool",
        "name": "弄臣",
        "englishName": "Fool",
        "category": "townsfolk",
        "team": "good",
        "ability": "当你首次将要死亡时，你不会死亡。",
        "flavor": "",
        "firstNight": 0,
        "otherNight": 0,
        "firstNightReminder": "",
        "otherNightReminder": "",
        "reminders": [
          "失去能力"
        ],
        "remindersGlobal": []
      },
      {
        "id": "tinker",
        "name": "修补匠",
        "englishName": "Tinker",
        "category": "outsider",
        "team": "good",
        "ability": "你随时可能死亡。",
        "flavor": "",
        "firstNight": 0,
        "otherNight": 48,
        "firstNightReminder": "",
        "otherNightReminder": "修补匠可能会死亡。如果说书人选择让修补匠死亡，放置死亡标记。",
        "reminders": [
          "死亡"
        ],
        "remindersGlobal": []
      },
      {
        "id": "moonchild",
        "name": "月之子",
        "englishName": "Moonchild",
        "category": "outsider",
        "team": "good",
        "ability": "当你得知你死亡时，你要公开选择一名存活的玩家。如果他是善良的，在当晚他会死亡。",
        "flavor": "",
        "firstNight": 0,
        "otherNight": 49,
        "firstNightReminder": "",
        "otherNightReminder": "如果月之子在白天触发了死亡能力并选择了一名善良玩家，该玩家死亡。标记那名玩家死亡。",
        "reminders": [
          "死亡"
        ],
        "remindersGlobal": []
      },
      {
        "id": "goon",
        "name": "莽夫",
        "englishName": "Goon",
        "category": "outsider",
        "team": "good",
        "ability": "每个夜晚，首个使用其自身能力选择了你的玩家会醉酒直到下个黄昏。你会转变为他的阵营。",
        "flavor": "",
        "firstNight": 0,
        "otherNight": 0,
        "firstNightReminder": "",
        "otherNightReminder": "",
        "reminders": [
          "醉酒"
        ],
        "remindersGlobal": []
      },
      {
        "id": "lunatic",
        "name": "疯子",
        "englishName": "Lunatic",
        "category": "outsider",
        "team": "good",
        "ability": "你以为你是一个恶魔，但其实你不是。恶魔知道你是疯子以及你在每个夜晚选择了哪些玩家。",
        "flavor": "",
        "firstNight": 7,
        "otherNight": 21,
        "firstNightReminder": "如果有七名或更多玩家，唤醒疯子：展示“他们是你的爪牙”信息标记。指向任意对应数量的玩家。展示“这些角色不在场”信息标记。展示三个善良角色。让疯子重新入睡。唤醒恶魔。展示“你是”信息标记和恶魔角色标记。展示“这名玩家是”信息标记和疯子角色标记，然后指向疯子玩家。",
        "otherNightReminder": "做任何需要做的事情来模拟一位恶魔的行动。让疯子重新入睡。唤醒恶魔。对恶魔展示疯子角色标记，并指向疯子玩家，随后是疯子的攻击目标。",
        "reminders": [],
        "remindersGlobal": [
          "被选择",
          "是疯子"
        ]
      },
      {
        "id": "godfather",
        "name": "教父",
        "englishName": "Godfather",
        "category": "minion",
        "team": "evil",
        "ability": "在你的首个夜晚，你会得知有哪些外来者角色在场。如果有外来者在白天死亡，你会在当晚被唤醒并且你要选择一名玩家：他死亡。[-1或+1外来者]",
        "flavor": "",
        "firstNight": 21,
        "otherNight": 38,
        "firstNightReminder": "对他展示所有在场的外来者标记。",
        "otherNightReminder": "如果有外来者在今天白天死亡，让教父选择一名玩家。标记那名玩家死亡。",
        "reminders": [
          "死于今日",
          "死亡"
        ],
        "remindersGlobal": []
      },
      {
        "id": "devil-s-advocate",
        "name": "魔鬼代言人",
        "englishName": "Devil's Advocate",
        "category": "minion",
        "team": "evil",
        "ability": "每个夜晚，你要选择一名存活的玩家（与上个夜晚不同）：如果明天白天他被处决，他不会死亡。",
        "flavor": "",
        "firstNight": 22,
        "otherNight": 14,
        "firstNightReminder": "让魔鬼代言人选择一名存活玩家。标记那名玩家处决不死。",
        "otherNightReminder": "让魔鬼代言人选择一名存活玩家，不能是上一夜他选择过的玩家。标记那名玩家处决不死。",
        "reminders": [
          "处决不死"
        ],
        "remindersGlobal": []
      },
      {
        "id": "assassin",
        "name": "刺客",
        "englishName": "Assassin",
        "category": "minion",
        "team": "evil",
        "ability": "每局游戏限一次，在夜晚时*，你可以选择一名玩家：他死亡，即使因为任何原因让他不会死亡。",
        "flavor": "",
        "firstNight": 0,
        "otherNight": 37,
        "firstNightReminder": "",
        "otherNightReminder": "刺客可以选择一名玩家。如果他这么做了，标记那名玩家死亡，且刺客失去能力，之后的夜晚无需再唤醒刺客。",
        "reminders": [
          "死亡",
          "失去能力"
        ],
        "remindersGlobal": []
      },
      {
        "id": "mastermind",
        "name": "主谋",
        "englishName": "Mastermind",
        "category": "minion",
        "team": "evil",
        "ability": "如果恶魔因为死于处决而因此导致游戏结束时，再额外进行一个夜晚和一个白天。在那个白天如果有玩家被处决，他的阵营落败。",
        "flavor": "",
        "firstNight": 0,
        "otherNight": 0,
        "firstNightReminder": "",
        "otherNightReminder": "",
        "reminders": [],
        "remindersGlobal": []
      },
      {
        "id": "zombuul",
        "name": "僵怖",
        "englishName": "Zombuul",
        "category": "demon",
        "team": "evil",
        "ability": "每个夜晚*，如果今天白天没有人死亡，你会被唤醒并要选择一名玩家：他死亡。当你首次死亡后，你仍存活，但会被当作死亡。",
        "flavor": "",
        "firstNight": 0,
        "otherNight": 25,
        "firstNightReminder": "",
        "otherNightReminder": "如果今天白天没有人死亡，让僵怖选择一名玩家。标记那名玩家死亡。",
        "reminders": [
          "死亡",
          "死于今日"
        ],
        "remindersGlobal": []
      },
      {
        "id": "pukka",
        "name": "普卡",
        "englishName": "Pukka",
        "category": "demon",
        "team": "evil",
        "ability": "每个夜晚，你要选择一名玩家：他中毒。上个因你的能力中毒的玩家会死亡并恢复健康。",
        "flavor": "",
        "firstNight": 28,
        "otherNight": 26,
        "firstNightReminder": "让普卡选择一名玩家。标记那名玩家中毒。",
        "otherNightReminder": "让普卡选择一名玩家。标记那名玩家中毒。上一个因普卡中毒的玩家死亡，随后恢复健康。",
        "reminders": [
          "死亡",
          "中毒"
        ],
        "remindersGlobal": []
      },
      {
        "id": "shabaloth",
        "name": "沙巴洛斯",
        "englishName": "Shabaloth",
        "category": "demon",
        "team": "evil",
        "ability": "每个夜晚*，你要选择两名玩家：他们死亡。你的上个夜晚选择过的且当前死亡的玩家可能会被你反刍。",
        "flavor": "",
        "firstNight": 0,
        "otherNight": 27,
        "firstNightReminder": "",
        "otherNightReminder": "上一夜被沙巴洛斯选择且当前已死亡的玩家之一可能被反刍，如果被反刍，标记那名玩家被复活。让沙巴洛斯选择两名玩家。标记这两名玩家死亡。",
        "reminders": [
          "死亡",
          "复活"
        ],
        "remindersGlobal": []
      },
      {
        "id": "po",
        "name": "珀",
        "englishName": "Po",
        "category": "demon",
        "team": "evil",
        "ability": "每个夜晚*，你可以选择一名玩家：他死亡。如果你上次选择时没有选择任何玩家，当晚你要选择三名玩家：他们死亡。",
        "flavor": "",
        "firstNight": 0,
        "otherNight": 28,
        "firstNightReminder": "",
        "otherNightReminder": "珀可以选择一名玩家；或如果上一次他被唤醒时未做选择，让他选择三名玩家。标记这些玩家死亡。",
        "reminders": [
          "死亡",
          "攻击三次"
        ],
        "remindersGlobal": []
      }
    ]
  },
  "snv": {
    "meta": {
      "name": "梦殒春宵",
      "logo": "https://oss.gstonegames.com/static/image/team/202206/c_3135245915561_027cd2ad.jpg",
      "description": "生机勃勃的春天已然过去，温暖迷人的夏天悄然来临。园丁在公园和窗栏上精心培育，让百花齐放，一望无际。鸟儿在歌唱，艺术家们拿起了画笔，哲学家在熙熙攘攘的酒馆里思索人生的终极奥秘，城镇周围搭建起老旧的帐篷预示着马戏团即将开启。<br><br>在人们沉湎于纸醉金迷和灯红酒绿时，黑暗势力却悄然崛起。女巫和异教徒们潜藏在郊区的宏伟遗迹之间，在地下洞穴中密谋着渗透城镇，而那在宴会中狂欢的鸦木布拉夫居民们却浑然不知。<br><br>良辰已至……<br><br>梦殒春宵。"
    },
    "roles": [
      {
        "id": "clockmaker",
        "name": "钟表匠",
        "englishName": "Clockmaker",
        "category": "townsfolk",
        "team": "good",
        "ability": "在你的首个夜晚，你会得知恶魔与爪牙之间最近的距离。（邻座的玩家距离为1）",
        "flavor": "",
        "firstNight": 40,
        "otherNight": 0,
        "firstNightReminder": "给他展示数字手势来告诉他恶魔与爪牙之间最近的距离。",
        "otherNightReminder": "",
        "reminders": [],
        "remindersGlobal": []
      },
      {
        "id": "dreamer",
        "name": "筑梦师",
        "englishName": "Dreamer",
        "category": "townsfolk",
        "team": "good",
        "ability": "每个夜晚，你要选择除你及旅行者以外的一名玩家：你会得知一个善良角色和一个邪恶角色，该玩家是其中一个角色。",
        "flavor": "",
        "firstNight": 41,
        "otherNight": 57,
        "firstNightReminder": "让筑梦师指向一名玩家。对他展示善良和邪恶的角色标记各一个，其中一个是属于该玩家的角色。",
        "otherNightReminder": "让筑梦师指向一名玩家。对他展示善良和邪恶的角色标记各一个，其中一个是属于该玩家的角色。",
        "reminders": [],
        "remindersGlobal": []
      },
      {
        "id": "snake-charmer",
        "name": "舞蛇人",
        "englishName": "Snake Charmer",
        "category": "townsfolk",
        "team": "good",
        "ability": "每个夜晚，你要选择一名存活的玩家：如果你选中了恶魔，你和他交换角色和阵营，然后他中毒。",
        "flavor": "",
        "firstNight": 20,
        "otherNight": 12,
        "firstNightReminder": "让舞蛇人选择一名玩家。如果舞蛇人选中了恶魔：展示“你是”信息标记和恶魔角色标记。用拇指向下代表他阵营变为邪恶。在魔典中交换舞蛇人和恶魔的角色标记。让原来的舞蛇人重新入睡。唤醒原来的恶魔。对老恶魔展示“你是”信息标记和舞蛇人角色标记，并用拇指向上代表他阵营变为善良。",
        "otherNightReminder": "让舞蛇人选择一名玩家。如果舞蛇人选中了恶魔：展示“你是”信息标记和恶魔角色标记。用拇指向下代表他阵营变为邪恶。在魔典中交换舞蛇人和恶魔的角色标记。让原来的舞蛇人重新入睡。唤醒原来的恶魔。对老恶魔展示“你是”信息标记和舞蛇人角色标记，并用拇指向上代表他阵营变为善良。",
        "reminders": [
          "中毒"
        ],
        "remindersGlobal": []
      },
      {
        "id": "mathematician",
        "name": "数学家",
        "englishName": "Mathematician",
        "category": "townsfolk",
        "team": "good",
        "ability": "每个夜晚，你会得知有多少名玩家的能力因为其他角色的能力而未正常生效。(从上个黎明到你被唤醒时）",
        "flavor": "",
        "firstNight": 51,
        "otherNight": 71,
        "firstNightReminder": "给他展示数字手势来告诉他在首个夜晚里有多少玩家的角色能力受他人影响而未正常生效。",
        "otherNightReminder": "给他展示数字手势来告诉他从上个黎明到数学家醒来前有多少玩家的角色能力受他人影响而未正常生效。",
        "reminders": [
          "未正常生效"
        ],
        "remindersGlobal": []
      },
      {
        "id": "flowergirl",
        "name": "卖花女孩",
        "englishName": "Flowergirl",
        "category": "townsfolk",
        "team": "good",
        "ability": "每个夜晚*，你会得知在今天白天时是否有恶魔投过票。",
        "flavor": "",
        "firstNight": 0,
        "otherNight": 58,
        "firstNightReminder": "",
        "otherNightReminder": "对她点头或摇头来示意今天白天是否有恶魔投过票。",
        "reminders": [
          "恶魔未投票",
          "恶魔已投票"
        ],
        "remindersGlobal": []
      },
      {
        "id": "town-crier",
        "name": "城镇公告员",
        "englishName": "Town Crier",
        "category": "townsfolk",
        "team": "good",
        "ability": "每个夜晚*，你会得知在今天白天时是否有爪牙发起过提名。",
        "flavor": "",
        "firstNight": 0,
        "otherNight": 59,
        "firstNightReminder": "",
        "otherNightReminder": "对他点头或摇头示意今天白天是否有爪牙发起过提名。",
        "reminders": [
          "爪牙未提名",
          "爪牙已提名"
        ],
        "remindersGlobal": []
      },
      {
        "id": "oracle",
        "name": "神谕者",
        "englishName": "Oracle",
        "category": "townsfolk",
        "team": "good",
        "ability": "每个夜晚*，你会得知有多少名死亡的玩家是邪恶的。",
        "flavor": "",
        "firstNight": 0,
        "otherNight": 60,
        "firstNightReminder": "",
        "otherNightReminder": "给他展示数字手势来告诉他当前已死亡的玩家中有多少玩家是邪恶的。",
        "reminders": [],
        "remindersGlobal": []
      },
      {
        "id": "savant",
        "name": "博学者",
        "englishName": "Savant",
        "category": "townsfolk",
        "team": "good",
        "ability": "每个白天，你可以私下拜访说书人以得知两条信息：一个是正确的，一个是错误的。",
        "flavor": "",
        "firstNight": 0,
        "otherNight": 0,
        "firstNightReminder": "",
        "otherNightReminder": "",
        "reminders": [],
        "remindersGlobal": []
      },
      {
        "id": "seamstress",
        "name": "女裁缝",
        "englishName": "Seamstress",
        "category": "townsfolk",
        "team": "good",
        "ability": "每局游戏限一次，在夜晚时，你可以选择除你以外的两名玩家：你会得知他们是否为同一阵营。",
        "flavor": "",
        "firstNight": 42,
        "otherNight": 61,
        "firstNightReminder": "女裁缝可以选择除自己以外的两名玩家。如果她这么做了，对她点头或摇头示意这两名玩家是否为同一阵营，随后标记女裁缝失去能力。之后的夜晚无需再唤醒女裁缝。",
        "otherNightReminder": "女裁缝可以选择除自己以外的两名玩家。如果她这么做了，对她点头或摇头示意这两名玩家是否为同一阵营，随后标记女裁缝失去能力。之后的夜晚无需再唤醒女裁缝。",
        "reminders": [
          "失去能力"
        ],
        "remindersGlobal": []
      },
      {
        "id": "philosopher",
        "name": "哲学家",
        "englishName": "Philosopher",
        "category": "townsfolk",
        "team": "good",
        "ability": "每局游戏限一次，在夜晚时，你可以选择一个善良角色：你获得该角色的能力。如果这个角色在场，他醉酒。",
        "flavor": "",
        "firstNight": 2,
        "otherNight": 2,
        "firstNightReminder": "哲学家可以选择一个角色。如果选择的角色不在场，将哲学家的角色标题替换成对应角色，并标记“是哲学家”，否则标记该角色对应的玩家醉酒。从现在开始，你需要以哲学家获得能力的那种角色的行动方式来唤醒哲学家。",
        "otherNightReminder": "哲学家可以选择一个角色。如果选择的角色不在场，将哲学家的角色标题替换成对应角色，并标记“是哲学家”，否则标记该角色对应的玩家醉酒。从现在开始，你需要以哲学家获得能力的那种角色的行动方式来唤醒哲学家。",
        "reminders": [
          "醉酒"
        ],
        "remindersGlobal": [
          "是哲学家"
        ]
      },
      {
        "id": "artist",
        "name": "艺术家",
        "englishName": "Artist",
        "category": "townsfolk",
        "team": "good",
        "ability": "每局游戏限一次，在白天时，你可以私下询问说书人一个是非问题，你会得知该问题的答案。",
        "flavor": "",
        "firstNight": 0,
        "otherNight": 0,
        "firstNightReminder": "",
        "otherNightReminder": "",
        "reminders": [
          "失去能力"
        ],
        "remindersGlobal": []
      },
      {
        "id": "juggler",
        "name": "杂耍艺人",
        "englishName": "Juggler",
        "category": "townsfolk",
        "team": "good",
        "ability": "在你的首个白天，你可以公开猜测任意玩家的角色最多五次。在当晚，你会得知猜测正确的角色数量。",
        "flavor": "",
        "firstNight": 0,
        "otherNight": 62,
        "firstNightReminder": "",
        "otherNightReminder": "给他展示数字手势来告诉他他当天白天猜测正确的次数。",
        "reminders": [
          "猜测正确"
        ],
        "remindersGlobal": []
      },
      {
        "id": "sage",
        "name": "贤者",
        "englishName": "Sage",
        "category": "townsfolk",
        "team": "good",
        "ability": "如果恶魔杀死了你，在当晚你会被唤醒并得知两名玩家，其中一名是杀死你的那个恶魔。",
        "flavor": "",
        "firstNight": 0,
        "otherNight": 43,
        "firstNightReminder": "",
        "otherNightReminder": "如果恶魔杀死了贤者，唤醒贤者并指向两名玩家，其中一名玩家是杀死他的恶魔。",
        "reminders": [],
        "remindersGlobal": []
      },
      {
        "id": "mutant",
        "name": "畸形秀演员",
        "englishName": "Mutant",
        "category": "outsider",
        "team": "good",
        "ability": "如果你“疯狂”地证明自己是外来者，你可能被处决。",
        "flavor": "",
        "firstNight": 0,
        "otherNight": 0,
        "firstNightReminder": "",
        "otherNightReminder": "",
        "reminders": [],
        "remindersGlobal": []
      },
      {
        "id": "sweetheart",
        "name": "心上人",
        "englishName": "Sweetheart",
        "category": "outsider",
        "team": "good",
        "ability": "当你死亡时，会有一名玩家开始醉酒。",
        "flavor": "",
        "firstNight": 0,
        "otherNight": 41,
        "firstNightReminder": "",
        "otherNightReminder": "如果心上人死亡，会有一名玩家立刻醉酒。如果你还没有让这件事情发生，那么现在为任意一位玩家放置醉酒标记。",
        "reminders": [
          "醉酒"
        ],
        "remindersGlobal": []
      },
      {
        "id": "barber",
        "name": "理发师",
        "englishName": "Barber",
        "category": "outsider",
        "team": "good",
        "ability": "如果你死亡，在当晚恶魔可以选择两名玩家（不能选择其他恶魔）交换角色。",
        "flavor": "",
        "firstNight": 0,
        "otherNight": 40,
        "firstNightReminder": "",
        "otherNightReminder": "如果理发师今天死亡了，唤醒恶魔并展示“该角色的效果对你生效”信息标记和理发师角色标记。如果恶魔选择了两名玩家，将这两名玩家分别独自唤醒。对他们展示“你是”信息标记和他们的新角色标记。",
        "reminders": [
          "今晚理发"
        ],
        "remindersGlobal": []
      },
      {
        "id": "klutz",
        "name": "呆瓜",
        "englishName": "Klutz",
        "category": "outsider",
        "team": "good",
        "ability": "当你得知你死亡时，你要公开选择一名存活的玩家：如果他是邪恶的，你的阵营落败。",
        "flavor": "",
        "firstNight": 0,
        "otherNight": 0,
        "firstNightReminder": "",
        "otherNightReminder": "",
        "reminders": [],
        "remindersGlobal": []
      },
      {
        "id": "evil-twin",
        "name": "镜像双子",
        "englishName": "Evil Twin",
        "category": "minion",
        "team": "evil",
        "ability": "你与一名对立阵营的玩家互相知道对方是什么角色。如果其中善良玩家被处决，邪恶阵营获胜。如果你们都存活，善良阵营无法获胜。",
        "flavor": "",
        "firstNight": 23,
        "otherNight": 0,
        "firstNightReminder": "唤醒镜像双子和他的对立双子，让他们进行眼神接触。对镜像双子展示对立双子的角色标记，并对对立双子展示镜像双子的角色标记。",
        "otherNightReminder": "",
        "reminders": [
          "对立双子"
        ],
        "remindersGlobal": []
      },
      {
        "id": "witch",
        "name": "女巫",
        "englishName": "Witch",
        "category": "minion",
        "team": "evil",
        "ability": "每个夜晚，你要选择一名玩家：如果他明天白天发起提名，他死亡。如果只有三名存活的玩家，你失去此能力。",
        "flavor": "",
        "firstNight": 24,
        "otherNight": 15,
        "firstNightReminder": "让女巫选择一名玩家。标记那名玩家被诅咒。",
        "otherNightReminder": "让女巫选择一名玩家。标记那名玩家被诅咒。",
        "reminders": [
          "被诅咒"
        ],
        "remindersGlobal": []
      },
      {
        "id": "cerenovus",
        "name": "洗脑师",
        "englishName": "Cerenovus",
        "category": "minion",
        "team": "evil",
        "ability": "每个夜晚，你要选择一名玩家和一个善良角色。他明天白天和夜晚需要“疯狂”地证明自己是这个角色，不然他可能被处决。",
        "flavor": "",
        "firstNight": 25,
        "otherNight": 16,
        "firstNightReminder": "让洗脑师选择一名玩家和一个善良角色。标记那名玩家疯狂。让洗脑师重新入睡。唤醒洗脑师的目标。对这名玩家展示“该角色的能力对你生效”信息标记，洗脑师角色标记，该玩家需要疯狂证明的角色标记。",
        "otherNightReminder": "让洗脑师选择一名玩家和一个善良角色。标记那名玩家疯狂。让洗脑师重新入睡。唤醒洗脑师的目标。对这名玩家展示“该角色的能力对你生效”信息标记，洗脑师角色标记，该玩家需要疯狂证明的角色标记。",
        "reminders": [
          "疯狂"
        ],
        "remindersGlobal": []
      },
      {
        "id": "pit-hag",
        "name": "麻脸巫婆",
        "englishName": "Pit-Hag",
        "category": "minion",
        "team": "evil",
        "ability": "每个夜晚*，你要选择一名玩家和一个角色，如果该角色不在场，他变成该角色。如果因此创造了一个恶魔，当晚的死亡由说书人决定。",
        "flavor": "",
        "firstNight": 0,
        "otherNight": 8,
        "firstNightReminder": "",
        "otherNightReminder": "让麻脸巫婆选择一名玩家和一个角色。如果她选择的角色不在场：让麻脸巫婆重新入睡。唤醒她的目标玩家。对该玩家展示“你是”信息标记和他的新角色标记。",
        "reminders": [],
        "remindersGlobal": []
      },
      {
        "id": "fang-gu",
        "name": "方古",
        "englishName": "Fang Gu",
        "category": "demon",
        "team": "evil",
        "ability": "每个夜晚*，你要选择一名玩家：他死亡。被该能力杀死的外来者改为变成邪恶的方古且你代替他死亡，但每局游戏仅能成功转化一次。[+1外来者]",
        "flavor": "",
        "firstNight": 0,
        "otherNight": 29,
        "firstNightReminder": "",
        "otherNightReminder": "让方古选择一名玩家。标记那名玩家死亡。如果他选择了外来者，且“首次”标记未放置在魔典中：用备用的方古角色标记替换那名外来者的角色标记。让方古重新入睡。唤醒方古的目标玩家。对该玩家展示“你是”信息标记和方古角色标记，并用拇指向下代表他阵营变为邪恶。将“首次”标记放置在魔典中。标记原本的方古玩家死亡，且他选择的玩家不会被标记为死亡。",
        "reminders": [
          "死亡"
        ],
        "remindersGlobal": [
          "限一次"
        ]
      },
      {
        "id": "vigormortis",
        "name": "亡骨魔",
        "englishName": "Vigormortis",
        "category": "demon",
        "team": "evil",
        "ability": "每个夜晚*，你要选择一名玩家：他死亡。被你杀死的爪牙保留他的能力，且与他邻近的两名镇民之一中毒。[-1外来者]",
        "flavor": "",
        "firstNight": 0,
        "otherNight": 32,
        "firstNightReminder": "",
        "otherNightReminder": "让亡骨魔选择一名玩家。标记那名玩家死亡。如果该玩家是爪牙，标记该玩家保留能力，并标记与该玩家邻近的镇民玩家之一中毒。",
        "reminders": [
          "死亡",
          "保留能力",
          "中毒"
        ],
        "remindersGlobal": []
      },
      {
        "id": "no-dashii",
        "name": "诺-达鲺",
        "englishName": "No Dashii",
        "category": "demon",
        "team": "evil",
        "ability": "每个夜晚*，你要选择一名玩家：他死亡。与你邻近的两名镇民中毒。",
        "flavor": "",
        "firstNight": 0,
        "otherNight": 30,
        "firstNightReminder": "",
        "otherNightReminder": "让诺-达鲺选择一名玩家。标记那名玩家死亡。",
        "reminders": [
          "死亡",
          "中毒"
        ],
        "remindersGlobal": []
      },
      {
        "id": "vortox",
        "name": "涡流",
        "englishName": "Vortox",
        "category": "demon",
        "team": "evil",
        "ability": "每个夜晚*，你要选择一名玩家：他死亡。镇民玩家的能力都会产生错误信息。如果白天没人被处决，邪恶阵营获胜。",
        "flavor": "",
        "firstNight": 0,
        "otherNight": 31,
        "firstNightReminder": "",
        "otherNightReminder": "让涡流选择一名玩家。标记那名玩家死亡。",
        "reminders": [
          "死亡"
        ],
        "remindersGlobal": []
      }
    ]
  }
};

function roleRows(scriptId) {
  return OFFICIAL_SCRIPT_REFERENCE[scriptId]?.roles ?? [];
}

export function getOfficialRoleReference(scriptId, roleIdOrName) {
  const key = `${roleIdOrName ?? ""}`.trim();
  if (!key) return null;
  return roleRows(scriptId).find((entry) => entry.id === key || entry.name === key || entry.englishName === key) ?? null;
}

export function getOfficialReminderCatalog(scriptId) {
  const values = new Set();
  roleRows(scriptId).forEach((entry) => {
    (entry.reminders ?? []).forEach((item) => values.add(item));
    (entry.remindersGlobal ?? []).forEach((item) => values.add(item));
  });
  return [...values];
}

export function getOfficialNightOrderNames(scriptId, phaseKey) {
  const key = phaseKey === "firstNight" ? "firstNight" : "otherNight";
  return roleRows(scriptId)
    .filter((entry) => Number(entry[key]) > 0)
    .sort((a, b) => Number(a[key]) - Number(b[key]))
    .map((entry) => entry.name);
}
