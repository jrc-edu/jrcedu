(function () {
  const feedbackStoreKey = "jrc-site-feedback-v1";
  const usageGuideStoreKey = "jrc-system-usage-guides-v1";
  const defaultUsageHelpGuides = [
    {
      name: "招生管理系统",
      match: [/advice-system/i, /admissions/i, /招生/],
      lines: [
        "第一阶段先用新生咨询建档台：有人咨询就先填学生姓名、年级、联系方式、生源来源、负责人、意向课程和下一步动作。",
        "生源来源必须选：线上客户、老生家长转介绍、扩科、其他；选择其他时补一句来源说明。",
        "试听中心：预约时填试听学生、学校、年级、试听班级、联系方式、微信昵称及微信号、试听日期时间、试听老师；试听后补跟进内容、试听反馈、下一步状态和提醒时间。",
        "报名建档：确认实收、课程产品、负责人和渠道归属；报名后归属锁定，需要解锁时必须留痕。",
        "转介绍：推荐人、奖励金额、发放状态和学情汇报节点集中查看。",
        "核对看板：按日、周、月、年看线索、试听、报名、转化和退费率；导出 Excel 用于周/月复盘。"
      ]
    },
    {
      name: "排课系统",
      match: [/paike/i, /排课/],
      lines: [
        "核心逻辑是“每位老师一张表”：按老师、月份、日期和六个固定时间段看课表，尽量贴近原 Excel 习惯。",
        "六个固定时间段：08:30-10:00、10:10-11:40、13:00-14:30、15:00-16:30、16:40-18:10、18:30-20:00。",
        "待排课池：先把还没排进去的学生/班级放进池子，再定位老师课表，找到空时间和空教室后标记已排。",
        "教室视图：按日期和时间看哪个教室已占用、哪个教室还能排课；未写教室的格子可以直接补教室。",
        "点名联动：排课确认后，学生服务系统可按日期、时间、老师、班级拉出点名表。",
        "发现数据缺失时，反馈具体老师、日期、时间段、班级、原 Excel 应该是什么、系统现在显示什么。"
      ]
    },
    {
      name: "财务系统",
      match: [/finance/i, /财务/],
      lines: [
        "先选月份，先看日常支出/报销/工作成本，再看月度收入与老师结算成本。",
        "老师结算重点核对：上课次数、课时费、试听/补贴/扣款、合计应发；不要一开始就在很长的明细表里翻。",
        "校区经营重点看：产值、老师课时成本、日常支出、其他经营成本、利润。",
        "点名课销核对先看程老师和小班课老师分组，再看老师明细和课次。",
        "AI 财务核对草稿默认收起，只在需要看缺项、金额线索、课时线索时展开。",
        "对账状态为待对账时，说明这条需要人工确认来源、金额或课次是否一致；待对账不是系统报错。",
        "如果金额不对，请反馈老师、月份、学生/班级、具体课次和你认为正确的金额。"
      ]
    },
    {
      name: "学生与家长服务系统",
      match: [/student-service/i, /学生|家长|点名|课消/],
      lines: [
        "第一阶段简化成四个入口：今日点名、新建/维护班级、历史点名与补登、班级汇总看板。",
        "今日点名：先选日期，系统显示当天班级卡片；点一个班级就带出学生名单，状态默认空白，老师手动点到课/迟到/请假/缺勤。",
        "新建/维护班级：可手工录班级、粘贴名单、上传 Excel/CSV，也可临时加人或减人。",
        "历史点名与补登：找过去一节课，必要时补登到当前表。",
        "出门测登分：可以上传 Excel，也可以手动录入；支持按姓名首字母和成绩排序。",
        "缺勤异常：按日期和班级处理，只看该班级异常学生。",
        "作业提交提醒：独立记录需要催交作业的学生，可按当前服务台过滤并标记完成。",
        "课堂反馈归档后，可回看学生历史反馈，用于下次备课和家长服务。"
      ]
    },
    {
      name: "教研与课程产品系统",
      match: [/curriculum-products/i, /教研|课程产品|授课大纲|课件/],
      lines: [
        "系统分两块：授课大纲和课程资料库，不再把大纲与普通资料混在一起。",
        "授课大纲：分程老师授课大纲、小课老师授课大纲、科学老师授课大纲，再按季节、年级、老师查找。",
        "课程资料库：按一到九年级目录展示，再按讲义、专题资料、好题资料、试卷、课件、老师版答案、板书照片、其他资料分类。",
        "权限：刘大君主要看 7-9 年级，赵萱主要看 1-6 年级，年级专家只看对应年级资料。",
        "上传资料时尽量写清版本、年级、课程体系、资料类型和适用场景，方便后续检索。",
        "同一资料更新时走版本更新，避免重复上传造成老师找错版本。",
        "需要查看图片时可点开预览，确需保存时再下载。"
      ]
    },
    {
      name: "教学质量系统",
      match: [/teaching-quality/i, /教学质量|巡课|质量/],
      lines: [
        "重点看巡课记录、课堂质量反馈、教学问题追踪和整改闭环。",
        "巡课记录可以附带文件名或附件线索，方便后续复查。",
        "问卷结果先支持导入 CSV/Excel 后内部分析，外部公开填写链接本轮暂不做。",
        "记录问题时写清老师、班级、日期、观察点和建议动作。",
        "如果问题需要执行，转成任务后由责任人反馈完成结果。",
        "质量数据用于改进教学，不作为单条孤立评价。",
        "负责人要定期看未闭环问题，推动复查。"
      ]
    },
    {
      name: "建议与任务协同系统",
      match: [/suggestions/i, /建议|任务协同|试用反馈|反馈整改/],
      lines: [
        "员工建议池只放员工建议，大家可以支持、补充和转任务。",
        "需要执行的建议由管理员派给负责人，负责人在我的任务里提交完成反馈。",
        "试用反馈整改单独管理，新问题和复核仍有问题的内容会进入待讨论清单。",
        "自己提交的问题可以在我的反馈里复核：已解决就确认，未解决就继续补充。",
        "页面过长时先用筛选：只看自己、待处理、继续反馈、已转任务。"
      ]
    },
    {
      name: "校区运营与人事系统",
      match: [/campus-operations|hr-training/i, /校区运营|人事|岗位宣传栏|岗位排班|暑假排班/],
      lines: [
        "系统分为校区运营、岗位宣传栏、人事管理三块。",
        "校区运营分公告公示类和工作流程类，只做展示，不做审批和任务流。",
        "普通老师以查看为主；陈雨晴和程志豪可以进入编辑入口维护公告、流程、岗位宣传栏和人事信息。",
        "人事管理用于员工档案、入职、转正、离职留痕和权限交接。",
        "返回按钮应先回到校区运营与人事系统，再回工作台。"
      ]
    },
    {
      name: "课堂反馈AI助手",
      match: [/ai-assistant/i, /课堂反馈AI|AI助手|课堂反馈/],
      lines: [
        "只做课堂反馈：老师输入或语音转文字后，AI按统一五段模板生成家长可读反馈。",
        "关联对象可同时填多个学生姓名，建议用顿号、逗号、空格或换行分隔。",
        "生成后先在整理结果里直接修改，可直接保存草稿或归档；网页端不再判断“待补完整”并拦截归档。",
        "草稿库最多保留近期草稿，便于老师课后继续精修；归档后进入学生服务历史反馈。",
        "批量生成时，每个学生草稿只能保留本学生信息，不能混入其他学生姓名。"
      ]
    },
    {
      name: "学管知识库系统",
      match: [/knowledge/i, /知识库|学管/],
      lines: [
        "用于沉淀学管常用话术、家长沟通流程、续费提醒和异常处理经验。",
        "先按场景查找：续费、缺勤、作业、投诉、转班、退费等。",
        "新增内容要写清适用场景、建议话术、注意事项和负责人。",
        "知识库内容用于统一学管服务口径，不替代具体学生记录。",
        "发现内容不准确时提交反馈，由负责人统一修订。"
      ]
    }
  ];
  const usageHelpQuestionSets = {
    招生管理系统: ["新咨询学生怎么建档？", "试听结束后下一步怎么做？", "转介绍奖励和学情汇报怎么看？"],
    排课系统: ["待排课池怎么用？", "老师课表和教室表怎么一起看？", "未写教室怎么补？"],
    财务系统: ["一进来先看哪里？", "待对账是什么意思？", "其他经营成本怎么进入利润？"],
    学生与家长服务系统: ["今日点名怎么操作？", "怎么新建或维护班级名单？", "历史点名怎么补登？"],
    教研与课程产品系统: ["资料库和授课大纲有什么区别？", "授课大纲怎么查找？", "年级权限怎么看？"],
    教学质量系统: ["问卷结果怎么导入？", "巡课记录怎么填写？", "为什么暂不做外部问卷链接？"],
    建议与任务协同系统: ["建议怎么转任务？", "我的反馈怎么复核？", "页面太长怎么筛选？"],
    校区运营与人事系统: ["公告公示怎么看？", "工作流程在哪里查？", "谁可以维护校区运营内容？"],
    课堂反馈AI助手: ["课堂反馈怎么生成？", "多个学生怎么分开生成？", "草稿和归档在哪里看？"],
    学管知识库系统: ["家长沟通话术怎么查？", "知识库内容怎么新增？", "内容不准确怎么反馈？"]
  };
  const usageHelpGuideSections = {
    招生管理系统: [
      {
        title: "日常工作顺序",
        items: [
          "第一阶段按最简单链路跑：有人咨询就建档，能约试听就约试听，试听后填反馈，最后报名或搁置回访。",
          "约试听前必须确认学生、年级、联系方式、来源、负责人。",
          "试听结束后当天补齐试听反馈、下一步状态、自动提醒时间，避免线索断档。",
          "报名后进入报名建档，确认课程产品、实收金额、负责人、渠道归属、推荐人。"
        ]
      },
      {
        title: "必须核对",
        items: [
          "生源来源必须从线上客户、老生家长转介绍、扩科、其他中选择。",
          "微信昵称及微信号、联系电话是两项信息；有哪个填哪个，尽量都补齐。",
          "报名课程产品按程老师班课、科学班课、数学小班课、科学小班课、数学一对一、科学一对一选择。",
          "报名后归属链默认锁定，确实要改时走解锁并保留操作记录。"
        ]
      },
      {
        title: "常用入口",
        items: [
          "线索中心用于筛选、导出和复盘。",
          "试听中心用于预约试听、填写试听反馈和推进下一步。",
          "招生看板按日、周、月、年查看线索量、试听量、报名量、转化情况和退费率。",
          "转介绍模块集中看推荐人、奖励金额、发放状态、排名和学情汇报节点。"
        ]
      }
    ],
    排课系统: [
      {
        title: "一进来先看哪里",
        items: [
          "先看“每位老师一张月课表”，它最接近你们原来的老师 Excel 表。",
          "第一步选月份，第二步选老师；普通老师可直接点“我的课表”，排课负责人可逐个点老师卡片。",
          "表格横向是日期，纵向是六个固定时间段；格子里有学生/班级就是已排课，显示“可排”才表示这个老师此时间没有课。"
        ]
      },
      {
        title: "排新课怎么判断能不能排",
        items: [
          "先看老师课表：老师这一格必须是“可排”。",
          "再点“看教室表”：同一天、同一时间段要有空教室。",
          "还没排进去的学生先放入“待排课池”，定位老师课表后再决定排不排。",
          "最后看“冲突检测”和“未写教室”：同老师、同教室、同学生撞时间要先修；未写教室的课要先补教室。"
        ]
      },
      {
        title: "没数据或数据不对时",
        items: [
          "先确认月份、老师、显示范围是不是选错；再用课程搜索查学生或班级。",
          "如果老师卡片没有课程，说明当前月份没有识别到该老师课表或姓名不一致。",
          "反馈时写清：月份、老师、日期、时间段、学生/班级、原 Excel 应该是什么、系统现在显示什么。"
        ]
      }
    ],
    财务系统: [
      {
        title: "一进来先看哪里",
        items: [
          "先选月份，再看日常支出/工作成本和老师结算入口。",
          "点某位老师后，先看工资单合计，不要一开始就展开很长的逐课次明细。",
          "老师核对最重要三件事：工资明细应发、明细条数/学生数、待对账数量。"
        ]
      },
      {
        title: "待对账怎么核",
        items: [
          "“待对账”不是错误，表示这条来自原工资表、排课或点名，需要人工确认口径。",
          "先点“只看待对账”，集中核金额、课次、来源文件、学生/班级是否一致。",
          "AI 财务核对草稿默认收起，需要找金额线索、课时线索、缺项和风险时再展开。",
          "只有总额或课次对不上时，再展开“逐课次明细”查单条；平时不要在长表里找。"
        ]
      },
      {
        title: "没数据或金额不对时",
        items: [
          "先确认月份是否正确；五月、六月、暑假月份不要混看。",
          "没有总表但有明细时，说明系统读到了工资明细，还缺产值总表行；这不是最终错误。",
          "其他经营成本会进入成本和利润口径，和日常支出一起影响利润。",
          "反馈金额问题时写清：月份、老师、Excel 原值、系统显示值、学生/班级或具体课次。"
        ]
      }
    ],
    学生与家长服务系统: [
      {
        title: "一进来先选哪个系统",
        items: [
          "第一阶段只保留四个主要入口：今日点名、新建/维护班级、历史点名与补登、班级汇总看板。",
          "程老师班课、小班课、科学课仍作为服务台范围，后面的点名、成绩、异常、学生档案都会按这个范围过滤。",
          "如果看见学生太多，先确认是不是服务台范围或日期选错。"
        ]
      },
      {
        title: "点名课消怎么做",
        items: [
          "先选日期，系统会显示当天可点名班级卡片，卡片里有时间、老师、教室和人数。",
          "点一个班级卡片后，系统会自动带出学生名单；学生状态默认都是未点名/空白，老师要逐个手动点。",
          "如果当天没有排课或临时加人，可以在“录入班级点名表”里粘贴名单、上传 Excel/CSV，或用“加人员”。",
          "历史点名与补登可以把过去一节课带回当前表，适合漏点名后补录。",
          "保存点名后，缺勤异常、课销、老师课时费和学生服务档案都会读取这条记录。"
        ]
      },
      {
        title: "出门测和异常处理",
        items: [
          "出门测可手填，也可上传 Excel 自动匹配；录完可按姓名首字母或成绩排序。",
          "缺勤异常按日期和班级处理，只处理这个班级的异常学生，不在全量长表里翻。",
          "作业提交提醒单独管理，可按服务台过滤并标记完成。",
          "课堂反馈归档后在学生历史反馈里查看，用于学管复制给家长或老师下次备课。"
        ]
      }
    ],
    教研与课程产品系统: [
      {
        title: "两大入口",
        items: [
          "授课大纲和课程资料库是两个入口，大纲归大纲，普通资料归资料库。",
          "授课大纲按程老师、小课老师、科学老师，再按季节、年级、老师查找。",
          "课程资料库按年级目录和资料类型查找，避免所有资料混成一张长表。"
        ]
      },
      {
        title: "授课大纲",
        items: [
          "授课大纲分程老师授课大纲、小课老师授课大纲、科学老师授课大纲。",
          "小课老师大纲按老师姓名、季节、年级查找；科学老师按海滢滢、姚老师、朱永乐查找。",
          "同类大纲只展示最新版本，历史版本用于留痕和回溯。"
        ]
      },
      {
        title: "上传规范",
        items: [
          "资料库类型包括讲义、专题资料、好题资料、试卷、课件、老师版答案、板书照片、其他资料。",
          "刘大君默认负责 7-9 年级资料，赵萱默认负责 1-6 年级资料，年级专家只能看对应年级。",
          "上传时写清版本、年级、课程体系、适用场景，减少重复资料。",
          "更新资料优先走版本更新，不要重复上传多个相似文件。",
          "图片资料可在线打开查看，确需保存时再下载或另存。"
        ]
      }
    ],
    教学质量系统: [
      {
        title: "质量记录",
        items: [
          "巡课记录要写清老师、班级、日期、观察点、问题和建议动作。",
          "巡课可记录附件文件名，方便之后回看证据或资料。",
          "课堂质量反馈用于改进教学，不建议把单条记录当作最终评价。",
          "教学问题如果需要执行，可以转任务给责任人。"
        ]
      },
      {
        title: "整改闭环",
        items: [
          "负责人要看未闭环问题，推动复查和完成反馈。",
          "问题完成后要记录处理结果，方便后续质量复盘。",
          "问卷结果先通过内部导入 CSV/Excel 分析老师均分、样本数和高频薄弱标签。",
          "外部公开填写链接暂不做，因为家长身份、学生归属、重复提交和隐私授权还没统一。",
          "质量等级或系数进入财务前需要管理层和财务核对。"
        ]
      },
      {
        title: "负责人权限",
        items: [
          "教学质量负责人需要有访问和编辑权限。",
          "普通老师主要查看与自己相关的质量反馈。",
          "发现权限异常时，在反馈问题里写清账号、模块和缺少的入口。"
        ]
      }
    ],
    建议与任务协同系统: [
      {
        title: "员工建议池看什么",
        items: [
          "员工建议池只放日常经营、流程、系统、教学、家长服务等改进建议。",
          "课堂反馈草稿、模块负责人试用监管、流程待办、反馈复核不应该混在员工建议池里。",
          "大家可以点支持，后续按支持数量和实际贡献评估奖励；页面默认按支持数和处理状态排序。"
        ]
      },
      {
        title: "建议怎么变任务",
        items: [
          "管理员判断建议需要执行时，点“派任务”，选择负责人和处理说明。",
          "负责人会在首页“我的建议任务”和建议系统里看到任务。",
          "负责人提交完成反馈后，结果会回写到原建议；建议处理完成后重点看标题、内容、建议人和支持数量。"
        ]
      },
      {
        title: "试用反馈去哪里",
        items: [
          "全站试用反馈统一去“试用反馈整改系统”，不再和员工建议混在一起。",
          "管理员标记已整改后，提出人到“只看自己/待我复核”里确认；解决就点确认，没解决就继续反馈。",
          "本轮待讨论 CSV 只导出新问题和复核后仍有问题；已整改待复核、已转任务、已确认解决不重复导出。"
        ]
      }
    ],
    校区运营与人事系统: [
      {
        title: "一进来先看三块",
        items: [
          "系统分校区运营、岗位宣传栏、人事管理三块；普通老师主要看校区运营的公告公示、工作流程和岗位宣传栏。",
          "校区运营分公告公示类和工作流程类；值班表、学管排班表、招聘情况放公告公示，招聘、面试、淘汰、入职离职方法放工作流程。",
          "校区运营编辑入口只给有管理权限的账号；普通老师只查看。"
        ]
      },
      {
        title: "岗位宣传栏",
        items: [
          "普通老师以查看为主；陈雨晴和程志豪可以进入编辑入口维护公告、流程、岗位宣传栏和人事信息。",
          "所有老师可查看；陈雨晴和程志豪可新增、修改、删除岗位设置。",
          "管理员可以直接拖动岗位卡片调整展示顺序，松手后会保存到云端。"
        ]
      },
      {
        title: "人事管理",
        items: [
          "人事管理用于员工档案、入职、转正、离职和权限交接。",
          "离职处理会停用账号和权限，删除不必要展示信息，但保留本月排课、上课、工资结算历史方便对账。",
          "待转正提醒要点开查看具体人员、入职日期和转正日期；不是只看一个数字。"
        ]
      }
    ],
    课堂反馈AI助手: [
      {
        title: "生成流程",
        items: [
          "老师输入课堂口述或使用输入法语音转文字，关联对象填写一个或多个学生。",
          "AI按统一课堂反馈模板生成家长可读内容。",
          "生成结果可直接编辑，保存草稿或归档；网页端不再做待补完整判断，不会因为误判阻止归档。"
        ]
      },
      {
        title: "多人反馈",
        items: [
          "多个学生姓名可用顿号、逗号、空格或换行分隔。",
          "系统会按学生切分草稿，每个草稿只保留本学生信息。",
          "如果草稿里混入其他学生姓名，请老师直接在草稿里删掉并保存。"
        ]
      },
      {
        title: "草稿与归档",
        items: [
          "草稿库保留近期草稿，方便老师课后继续修改。",
          "已归档内容进入学生服务系统，学管可查看历史反馈。",
          "课堂反馈必须调用 DeepSeek；调用失败时不会生成正式反馈。"
        ]
      }
    ],
    学管知识库系统: [
      {
        title: "使用场景",
        items: [
          "知识库沉淀学管常用话术、续费提醒、缺勤处理、家长沟通和投诉处理经验。",
          "查询时先按场景找，再按关键词细查。",
          "知识库提供服务口径，不替代具体学生服务记录。"
        ]
      },
      {
        title: "维护方法",
        items: [
          "新增内容要写清适用场景、建议话术、注意事项和负责人。",
          "发现内容不准确时提交反馈，由负责人统一修订。",
          "常用内容应逐步沉淀成标准流程，减少口头传递。"
        ]
      }
    ]
  };
  let usageHelpGuides = defaultUsageHelpGuides.map((guide) => ({ ...guide }));

  function currentEmployee() {
    return window.JRC_CURRENT_EMPLOYEE || null;
  }

  function safeParse(raw, fallback) {
    try {
      const parsed = JSON.parse(raw || "");
      return parsed ?? fallback;
    } catch {
      return fallback;
    }
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function readFeedbackRows() {
    const rows = safeParse(localStorage.getItem(feedbackStoreKey), []);
    return Array.isArray(rows) ? rows : [];
  }

  function rowBelongsToCurrentUser(row) {
    const employee = currentEmployee();
    if (!employee) return false;
    const currentName = String(employee.name || "").trim();
    const currentUsername = String(employee.username || "").trim().toLowerCase();
    const rowName = String(row?.userName || row?.name || "").trim();
    const rowUsername = String(row?.username || "").trim().toLowerCase();
    return Boolean((currentName && rowName === currentName) || (currentUsername && rowUsername === currentUsername));
  }

  function statusTone(status) {
    if (["已确认解决", "已处理", "已转任务"].includes(status)) return "done";
    if (status === "继续反馈") return "warn";
    return "open";
  }

  function feedbackStats(rows) {
    const list = Array.isArray(rows) ? rows : [];
    const processedStatuses = ["已确认解决", "已处理", "已转任务"];
    const processed = list.filter((row) => processedStatuses.includes(row?.status || "")).length;
    const reopened = list.filter((row) => row?.status === "继续反馈").length;
    return {
      total: list.length,
      processed,
      pending: Math.max(0, list.length - processed),
      reopened
    };
  }

  function writeFeedbackRows(rows) {
    localStorage.setItem(feedbackStoreKey, JSON.stringify(rows.slice(0, 300)));
  }

  function normalizeGuidePayload(payload) {
    const rows = Array.isArray(payload?.guides) ? payload.guides : Array.isArray(payload) ? payload : [];
    return rows
      .filter((row) => row && typeof row === "object" && row.name)
      .map((row) => ({
        ...row,
        name: String(row.name || "").trim(),
        lines: Array.isArray(row.lines) ? row.lines.map((item) => String(item || "").trim()).filter(Boolean) : [],
        sections: Array.isArray(row.sections) ? row.sections.map((section) => ({
          title: String(section?.title || "").trim(),
          items: Array.isArray(section?.items) ? section.items.map((item) => String(item || "").trim()).filter(Boolean) : []
        })).filter((section) => section.title || section.items.length) : [],
        questions: Array.isArray(row.questions) ? row.questions.map((item) => String(item || "").trim()).filter(Boolean) : []
      }))
      .filter((row) => row.name && (row.lines.length || row.sections.length || row.questions.length));
  }

  function mergeUsageGuides(remoteRows) {
    if (!remoteRows.length) return;
    const defaults = new Map(defaultUsageHelpGuides.map((guide) => [guide.name, guide]));
    const next = defaultUsageHelpGuides.map((guide) => ({ ...guide }));
    remoteRows.forEach((remote) => {
      const base = defaults.get(remote.name);
      const merged = {
        ...(base || {}),
        ...remote,
        match: base?.match || remote.match || [new RegExp(remote.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))],
        lines: remote.lines.length ? remote.lines : (base?.lines || []),
        sections: remote.sections.length ? remote.sections : (usageHelpGuideSections[remote.name] || []),
        questions: remote.questions.length ? remote.questions : (usageHelpQuestionSets[remote.name] || [])
      };
      const index = next.findIndex((guide) => guide.name === remote.name);
      if (index >= 0) next[index] = merged;
      else next.push(merged);
    });
    usageHelpGuides = next;
  }

  async function hydrateUsageGuidesFromCloud() {
    if (!window.JRC_CLOUD?.readModuleData) return;
    try {
      const result = await window.JRC_CLOUD.readModuleData(usageGuideStoreKey);
      const rows = normalizeGuidePayload(result?.data?.payload);
      mergeUsageGuides(rows);
      document.querySelectorAll(".jrc-feedback-dock").forEach(syncUsageHelpPanel);
    } catch {
      // Built-in usage guides remain available when cloud help library is offline.
    }
  }

  function mergeFeedbackRows(...groups) {
    const map = new Map();
    const rowTime = (row) => {
      const notes = Array.isArray(row?.reviewNotes) ? row.reviewNotes : [];
      const noteTime = notes.map((note) => Date.parse(note?.time || "") || 0).reduce((max, value) => Math.max(max, value), 0);
      return Math.max(
        Date.parse(row?.updatedAt || "") || 0,
        Date.parse(row?.processedAt || "") || 0,
        Date.parse(row?.confirmedAt || "") || 0,
        Date.parse(row?.reopenedAt || "") || 0,
        Date.parse(row?.createdAt || "") || 0,
        noteTime
      );
    };
    groups.flat().forEach((row) => {
      if (!row || typeof row !== "object") return;
      const id = String(row.id || "").trim() || `FB-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
      const existing = map.get(id);
      if (!existing) {
        map.set(id, { ...row, id });
        return;
      }
      const rowIsNewer = rowTime(row) >= rowTime(existing);
      map.set(id, rowIsNewer ? { ...existing, ...row, id } : { ...row, ...existing, id });
    });
    return [...map.values()]
      .sort((left, right) => String(right.createdAt || "").localeCompare(String(left.createdAt || "")))
      .slice(0, 300);
  }

  function systemName() {
    const subtitle = document.querySelector(".brand-subtitle")?.textContent?.trim();
    const title = document.querySelector("h1")?.textContent?.trim();
    if (subtitle && title) return `${subtitle}｜${title}`;
    return title || document.title || "匠人程工作台";
  }

  function normalizedPath() {
    return window.location.pathname.replace(/\/+$/, "");
  }

  function isPortalHomePage() {
    const path = normalizedPath();
    return path.endsWith("/portal") || path.endsWith("/portal/index.html");
  }

  function shouldShowUsageHelp() {
    return !isPortalHomePage();
  }

  function currentUsageGuide() {
    const haystack = [
      window.location.pathname,
      document.title,
      systemName(),
      ...[...document.querySelectorAll("h1, h2")].map((node) => node.textContent?.trim() || "")
    ].join(" ");
    return usageHelpGuides.find((guide) => guide.match.some((pattern) => pattern.test(haystack))) || {
      name: systemName(),
      lines: [
        "先看页面顶部标题和主操作按钮，确认自己当前在哪个系统。",
        "再按日期、老师、学生、班级、负责人等筛选条件缩小范围。",
        "数据不对时，先核对筛选条件，再记录具体对象、日期、页面和错误内容。",
        "仍看不懂或不好用时，点反馈问题提交，后续可在我的反馈里查看处理状态。"
      ]
    };
  }

  function usageGuideQuestions(guide) {
    return guide?.questions?.length ? guide.questions : (usageHelpQuestionSets[guide?.name] || ["这个页面应该先看哪里、先点哪里？", "这个页面的数据不对，我应该怎么核对？", "我看不懂这个系统，应该怎么反馈问题？"]);
  }

  function usageGuideSections(guide) {
    return guide?.sections?.length ? guide.sections : (usageHelpGuideSections[guide?.name] || []);
  }

  function usageGuideText(guide) {
    const lines = Array.isArray(guide?.lines) ? guide.lines : [];
    const sections = usageGuideSections(guide);
    return [
      ...lines.map((line, index) => `${index + 1}. ${line}`),
      ...sections.map((section) => {
        const items = section.items.map((item, index) => `${index + 1}. ${item}`).join("\n");
        return `${section.title}\n${items}`;
      })
    ].join("\n");
  }

  function usageHelpIntro(guide) {
    return [
      `当前按「${guide.name}」回答。`,
      "你可以直接点上面的常见问题，也可以输入自己遇到的具体操作问题。"
    ].join("\n");
  }

  function usageHelpQuickButtons(guide) {
    return usageGuideQuestions(guide)
      .map((question) => `<button type="button" data-jrc-help-question="${escapeHtml(question)}">${escapeHtml(question.replace(/[？?]$/, ""))}</button>`)
      .join("");
  }

  function usageHelpMarkup() {
    const guide = currentUsageGuide();
    return `
      <button class="jrc-help-button" type="button">使用方法AI提问助手</button>
      <div class="jrc-help-panel" hidden>
        <div class="jrc-feedback-head">
          <strong>使用方法AI提问助手</strong>
          <button type="button" class="jrc-help-close" aria-label="关闭使用方法助手">×</button>
        </div>
        <p class="jrc-help-current">当前系统：${escapeHtml(guide.name)}</p>
        <div class="jrc-help-quick">
          ${usageHelpQuickButtons(guide)}
        </div>
        <label>
          你的问题
          <textarea class="jrc-help-question" placeholder="例如：${escapeHtml(usageGuideQuestions(guide)[0])}"></textarea>
        </label>
        <button class="jrc-help-submit" type="button">问 AI</button>
        <div class="jrc-help-answer" aria-live="polite">
          ${escapeHtml(usageHelpIntro(guide))}
        </div>
      </div>
    `;
  }

  function syncUsageHelpPanel(dock) {
    if (!dock) return;
    const guide = currentUsageGuide();
    const current = dock.querySelector(".jrc-help-current");
    const quick = dock.querySelector(".jrc-help-quick");
    const question = dock.querySelector(".jrc-help-question");
    const answer = dock.querySelector(".jrc-help-answer");
    if (current) current.textContent = `当前系统：${guide.name}`;
    if (quick) quick.innerHTML = usageHelpQuickButtons(guide);
    if (question) question.placeholder = `例如：${usageGuideQuestions(guide)[0]}`;
    if (answer && answer.dataset.touched !== "true") answer.textContent = usageHelpIntro(guide);
  }

  function ensureUsageHelpInDock(dock) {
    if (!dock) return;
    if (!shouldShowUsageHelp()) {
      dock.querySelector(".jrc-help-button")?.remove();
      dock.querySelector(".jrc-help-panel")?.remove();
      return;
    }
    if (dock.querySelector(".jrc-help-button")) return;
    const template = document.createElement("template");
    template.innerHTML = usageHelpMarkup().trim();
    const target = dock.querySelector(".jrc-feedback-button");
    [...template.content.childNodes].forEach((node) => {
      dock.insertBefore(node, target || dock.firstChild);
    });
    syncUsageHelpPanel(dock);
  }

  async function saveFeedback(row) {
    let rows = mergeFeedbackRows([row], readFeedbackRows());
    writeFeedbackRows(rows);
    if (!window.JRC_CLOUD?.writeModuleData) {
      return { ok: false, localOnly: true };
    }
    try {
      if (window.JRC_CLOUD?.readModuleData) {
        const remote = await window.JRC_CLOUD.readModuleData(feedbackStoreKey);
        const remoteRows = Array.isArray(remote?.data?.payload) ? remote.data.payload : [];
        rows = mergeFeedbackRows([row], readFeedbackRows(), remoteRows);
        writeFeedbackRows(rows);
      }
      const result = await window.JRC_CLOUD.writeModuleData(feedbackStoreKey, "siteFeedback", rows);
      return result?.ok ? { ok: true } : { ok: false, localOnly: true };
    } catch {
      return { ok: false, localOnly: true };
    }
  }

  function enhanceTables() {
    document.querySelectorAll(".table-wrap").forEach((wrap) => {
      wrap.setAttribute("data-scroll-hint", "true");
      if (!wrap.hasAttribute("tabindex")) wrap.setAttribute("tabindex", "0");
      if (!wrap.getAttribute("aria-label")) wrap.setAttribute("aria-label", "可横向滑动的数据表格");
      const table = wrap.querySelector("table");
      if (table && !table.getAttribute("role")) {
        table.setAttribute("role", "table");
      }
    });
  }

  function enhanceActionGroups() {
    document.querySelectorAll(".actions, .section-actions, .top-actions, .filters").forEach((group) => {
      const buttons = group.querySelectorAll("button, .button, .nav-link, .status-chip");
      if (buttons.length >= 2) group.setAttribute("data-action-group", "true");
    });
  }

  function ensureFloatingHome() {
    const path = window.location.pathname;
    const isPortalHome = path.endsWith("/portal/index.html") || path.endsWith("/portal/") || path.endsWith("/portal");
    if (isPortalHome || document.querySelector(".jrc-floating-home")) return;
    const link = document.createElement("a");
    link.className = "jrc-floating-home";
    link.href = "/jrcedu/portal/index.html";
    link.textContent = "返回工作台";
    document.body.appendChild(link);
  }

  function ensurePwaHead() {
    const head = document.head;
    if (!head) return;
    const addMeta = (name, content) => {
      if (head.querySelector(`meta[name="${name}"]`)) return;
      const meta = document.createElement("meta");
      meta.name = name;
      meta.content = content;
      head.appendChild(meta);
    };
    const addLink = (rel, href, extra = {}) => {
      if (head.querySelector(`link[rel="${rel}"]`)) return;
      const link = document.createElement("link");
      link.rel = rel;
      link.href = href;
      Object.entries(extra).forEach(([key, value]) => link.setAttribute(key, value));
      head.appendChild(link);
    };
    addMeta("theme-color", "#0d9488");
    addMeta("apple-mobile-web-app-capable", "yes");
    addMeta("apple-mobile-web-app-title", "匠人程工作台");
    addMeta("mobile-web-app-capable", "yes");
    addLink("manifest", "/jrcedu/manifest.webmanifest");
    addLink("apple-touch-icon", "/jrcedu/icon.svg");
  }

  function slugifyHeading(text, fallback) {
    const base = String(text || "").trim().replace(/\s+/g, "-").replace(/[^\w\u4e00-\u9fa5-]/g, "");
    return base || fallback;
  }

  function ensureSectionDock() {
    if (document.querySelector(".jrc-section-dock")) return;
    const sections = [...document.querySelectorAll("main > section[id], main > article[id]")]
      .map((section, index) => {
        const heading = section.querySelector("h2, h1");
        const title = heading?.textContent?.trim();
        if (!title) return null;
        if (!section.id) section.id = slugifyHeading(title, `section-${index + 1}`);
        return { id: section.id, title, node: section };
      })
      .filter(Boolean);
    if (sections.length < 4) return;

    const shell = document.querySelector("main .shell") || document.querySelector("main");
    const topbar = document.querySelector(".topbar");
    if (!shell || !topbar) return;

    const dock = document.createElement("nav");
    dock.className = "jrc-section-dock";
    dock.setAttribute("aria-label", "页面分段导航");
    dock.innerHTML = `
      <strong>快速跳转</strong>
      <div class="jrc-section-dock__scroll">
        ${sections.map((section) => `<a class="jrc-section-dock__link" href="#${section.id}">${section.title}</a>`).join("")}
      </div>
    `;
    topbar.insertAdjacentElement("afterend", dock);

    const links = [...dock.querySelectorAll(".jrc-section-dock__link")];
    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      const activeId = visible.target.id;
      links.forEach((link) => link.classList.toggle("is-active", link.getAttribute("href") === `#${activeId}`));
    }, {
      rootMargin: "-20% 0px -55% 0px",
      threshold: [0.1, 0.25, 0.5]
    });

    sections.forEach((section) => observer.observe(section.node));
  }

  function enhanceFormFocus() {
    if (!window.matchMedia?.("(max-width: 760px)")?.matches) return;
    document.querySelectorAll("input, select, textarea").forEach((node) => {
      node.addEventListener("focus", () => {
        window.setTimeout(() => {
          node.scrollIntoView({ block: "center", behavior: "smooth" });
        }, 180);
      }, { passive: true });
    });
  }

  function ensureFeedbackDock() {
    let dock = document.querySelector(".jrc-feedback-dock");
    if (dock) {
      ensureUsageHelpInDock(dock);
    } else {
      dock = document.createElement("div");
      dock.className = "jrc-feedback-dock";
      dock.innerHTML = `
      ${shouldShowUsageHelp() ? usageHelpMarkup() : ""}
      <button class="jrc-feedback-button" type="button">反馈问题</button>
      <div class="jrc-feedback-panel" hidden>
        <div class="jrc-feedback-head">
          <strong>反馈问题</strong>
          <button type="button" class="jrc-feedback-close" aria-label="关闭反馈">×</button>
        </div>
        <label>
          问题类型
          <select class="jrc-feedback-type">
            <option>不好操作</option>
            <option>看不懂</option>
            <option>数据不对</option>
            <option>按钮点不开</option>
            <option>手机显示问题</option>
            <option>功能建议</option>
          </select>
        </label>
        <label>
          紧急程度
          <select class="jrc-feedback-severity">
            <option>普通</option>
            <option>紧急</option>
            <option>可后置</option>
          </select>
        </label>
        <label>
          问题说明
          <textarea class="jrc-feedback-content" placeholder="请写清楚在哪个页面、点了什么、希望怎么改。"></textarea>
        </label>
        <button class="jrc-feedback-submit" type="button">提交反馈</button>
        <p class="jrc-feedback-message">提交后可在这里查看状态，也可进入试用反馈整改系统复核。</p>
        <div class="jrc-feedback-history">
          <div class="jrc-feedback-history__head">
            <strong>我的反馈</strong>
            <a href="/jrcedu/portal/trial-feedback.html">查看全部</a>
          </div>
          <div class="jrc-feedback-history__stats"></div>
          <div class="jrc-feedback-history__list"></div>
        </div>
      </div>
    `;
      document.body.appendChild(dock);
    }
    syncUsageHelpPanel(dock);

    const panel = dock.querySelector(".jrc-feedback-panel");
    const openButton = dock.querySelector(".jrc-feedback-button");
    const closeButton = dock.querySelector(".jrc-feedback-close");
    const submitButton = dock.querySelector(".jrc-feedback-submit");
    const message = dock.querySelector(".jrc-feedback-message");
    const content = dock.querySelector(".jrc-feedback-content");
    const type = dock.querySelector(".jrc-feedback-type");
    const severity = dock.querySelector(".jrc-feedback-severity");
    const historyStats = dock.querySelector(".jrc-feedback-history__stats");
    const historyList = dock.querySelector(".jrc-feedback-history__list");
    const helpPanel = dock.querySelector(".jrc-help-panel");
    const helpButton = dock.querySelector(".jrc-help-button");
    const helpCloseButton = dock.querySelector(".jrc-help-close");
    const helpQuestion = dock.querySelector(".jrc-help-question");
    const helpSubmit = dock.querySelector(".jrc-help-submit");
    const helpAnswer = dock.querySelector(".jrc-help-answer");

    function pageUsageContext() {
      const title = systemName();
      const guide = currentUsageGuide();
      const headings = [...document.querySelectorAll("h1, h2, .nav-item h3, .quick-card strong")]
        .map((node) => node.textContent?.trim())
        .filter(Boolean)
        .slice(0, 18);
      const actions = [...document.querySelectorAll(".trial-toolbar a, .top-actions a, .top-actions button, .section-actions button, .button")]
        .map((node) => node.textContent?.trim())
        .filter(Boolean)
        .slice(0, 24);
      return [
        `当前页面：${title}`,
        `页面地址：${location.pathname}`,
        `当前系统说明：${guide.name}\n${usageGuideText(guide)}`,
        headings.length ? `页面栏目：${headings.join("、")}` : "",
        actions.length ? `可见按钮：${actions.join("、")}` : "",
        "请只回答当前工作台/当前页面怎么使用，不要闲聊。",
        "回答必须按这四段：1. 先点哪里；2. 再选什么；3. 看哪个结果；4. 没数据或点不动时检查什么。",
        "如果老师问的是功能是否合理，可以先解释现有设计，再提醒用右下角反馈问题提交改进建议。"
      ].filter(Boolean).join("\n");
    }

    function setHelpAnswer(text, tone = "") {
      if (!helpAnswer) return;
      helpAnswer.classList.toggle("is-error", tone === "error");
      helpAnswer.classList.toggle("is-loading", tone === "loading");
      helpAnswer.dataset.touched = "true";
      helpAnswer.textContent = text || "";
    }

    function localUsageAnswer(question) {
      const title = systemName();
      const text = String(question || "");
      const guide = currentUsageGuide();
      const guideLines = usageGuideText(guide);
      const base = `1. 先点哪里：进入「${guide.name || title}」，先看页面顶部标题和主要按钮，确认自己没有进错系统。\n2. 再选什么：按页面提供的日期、老师、学生、班级、负责人、月份等筛选项缩小范围。\n3. 看哪个结果：优先看页面里的结果表、结算结果、点名名单、处理状态或归档记录，不要先看很长的原始明细。\n4. 没数据或点不动时检查什么：先检查筛选条件、账号权限、是否已经保存到云端；仍不对就点“反馈问题”，写清页面、账号、设备、操作步骤和你期望看到的结果。\n\n本系统详细方法库：\n${guideLines}`;
      if (/反馈|提问题|问题/.test(text)) {
        return `当前是${guide.name}。\n先点页面右下角“反馈问题”，写清楚页面、你点了什么、系统显示什么、你希望怎么改。提交后进入“试用反馈整改系统”，点“只看自己”查看处理状态和复核。\n\n${base}`;
      }
      if (/核对|数据不对|不对/.test(text)) {
        return `先在${title}里确认筛选条件、日期/老师/学生/负责人是否选对；再看结果表和操作留痕。如果仍不一致，点“反馈问题”并写清学生、日期、页面、当前数据和你认为正确的数据。\n\n${base}`;
      }
      return `当前是${guide.name || title}。\n${base}\n\n如果你要问更具体的问题，可以写清楚“我在哪个页面、想做什么、点到哪一步”。`;
    }

    async function askUsageHelp(question) {
      const text = String(question || "").trim();
      if (!text) {
        setHelpAnswer("请先输入你想问的使用问题。", "error");
        return;
      }
      if (!window.JRC_CLOUD?.aiAssistant) {
        setHelpAnswer(localUsageAnswer(text));
        return;
      }
      helpSubmit.disabled = true;
      setHelpAnswer("正在按当前页面说明生成回答...", "loading");
      try {
        const employee = currentEmployee() || {};
        const response = await window.JRC_CLOUD.aiAssistant({
          mode: "help",
          target: systemName(),
          text: `${pageUsageContext()}\n\n老师问题：${text}`,
          operatorName: employee.name || "",
          operatorUsername: employee.username || "",
          operatorRole: employee.role || ""
        });
        if (!response?.ok || response.data?.warning || response.data?.provider === "local") {
          throw new Error(response?.data?.message || response?.message || "AI 暂时不可用");
        }
        const result = response.data?.result || {};
        const answer = String(result.parentMessage || result.polishedText || result.summary || "").trim();
        setHelpAnswer(answer || localUsageAnswer(text));
      } catch {
        setHelpAnswer(`AI 暂时不可用，先给你本地使用建议：\n${localUsageAnswer(text)}`);
      } finally {
        helpSubmit.disabled = false;
      }
    }

    function renderMyFeedbackHistory() {
      if (!historyList) return;
      const allMine = readFeedbackRows()
        .filter(rowBelongsToCurrentUser)
        .sort((left, right) => String(right.createdAt || "").localeCompare(String(left.createdAt || "")));
      const mine = allMine.slice(0, 5);
      if (historyStats) {
        const stats = feedbackStats(allMine);
        historyStats.innerHTML = `
          <span>共提 ${stats.total} 条</span>
          <span>已处理 ${stats.processed} 条</span>
          <span>待处理 ${stats.pending} 条</span>
          ${stats.reopened ? `<span>继续反馈 ${stats.reopened} 条</span>` : ""}
        `;
      }
      historyList.innerHTML = mine.length ? mine.map((row) => {
        const status = row.status || "待处理";
        const createdAt = String(row.createdAt || "").replace("T", " ").slice(0, 16);
        const contentText = String(row.content || "").slice(0, 44);
        const notes = Array.isArray(row.reviewNotes) ? row.reviewNotes : [];
        const latestNote = notes[notes.length - 1];
        const progressText = row.resolution || latestNote?.text || "";
        return `
          <div class="jrc-feedback-history__item">
            <span class="jrc-feedback-history__status ${statusTone(status)}">${escapeHtml(status)}</span>
            <strong>${escapeHtml(row.type || "试用反馈")}｜${escapeHtml(row.system || "未知页面")}</strong>
            <p>${escapeHtml(contentText)}${String(row.content || "").length > 44 ? "..." : ""}</p>
            ${progressText ? `<p><b>进展：</b>${escapeHtml(String(progressText).slice(0, 54))}${String(progressText).length > 54 ? "..." : ""}</p>` : ""}
            <small>${escapeHtml(createdAt || "刚刚")}</small>
          </div>
        `;
      }).join("") : `<p class="jrc-feedback-history__empty">你还没有提交过反馈。</p>`;
    }

    async function hydrateFeedbackHistory() {
      if (!window.JRC_CLOUD?.readModuleData) {
        renderMyFeedbackHistory();
        return;
      }
      try {
        const remote = await window.JRC_CLOUD.readModuleData(feedbackStoreKey);
        const remoteRows = Array.isArray(remote?.data?.payload) ? remote.data.payload : [];
        if (remoteRows.length) writeFeedbackRows(mergeFeedbackRows(readFeedbackRows(), remoteRows));
      } catch {
        // The local list is still useful if cloud history is temporarily unavailable.
      }
      renderMyFeedbackHistory();
    }

    if (dock.dataset.jrcFeedbackBound !== "true") {
      dock.dataset.jrcFeedbackBound = "true";
      openButton.addEventListener("click", () => {
        panel.hidden = !panel.hidden;
        if (!panel.hidden && helpPanel) helpPanel.hidden = true;
        if (!panel.hidden) {
          hydrateFeedbackHistory();
          content.focus();
        }
      });
      closeButton.addEventListener("click", () => {
        panel.hidden = true;
      });
      submitButton.addEventListener("click", async () => {
        const text = content.value.trim();
        if (!text) {
          message.textContent = "请先写一下问题说明。";
          return;
        }
        const employee = currentEmployee();
        submitButton.disabled = true;
        message.textContent = "正在提交...";
        const row = {
          id: `FB-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
          system: systemName(),
          type: type.value,
          severity: severity?.value || "普通",
          content: text,
          url: location.href,
          userName: employee?.name || "未登录",
          username: employee?.username || "",
          role: employee?.role || "",
          userAgent: navigator.userAgent,
          status: "待处理",
          createdAt: new Date().toISOString()
        };
        const result = await saveFeedback(row);
        content.value = "";
        submitButton.disabled = false;
        renderMyFeedbackHistory();
        message.textContent = result.ok ? "已提交到云端，可在“我的反馈”查看处理状态。" : "已暂存在当前设备，云端连接恢复后可再同步。";
        window.setTimeout(() => {
          panel.hidden = true;
          message.textContent = "提交后可在这里查看状态，也可进入试用反馈整改系统复核。";
        }, 1400);
      });
      renderMyFeedbackHistory();
    }

    if (helpButton && helpPanel && dock.dataset.jrcUsageHelpBound !== "true") {
      dock.dataset.jrcUsageHelpBound = "true";
      helpButton.addEventListener("click", () => {
        syncUsageHelpPanel(dock);
        helpPanel.hidden = !helpPanel.hidden;
        if (!helpPanel.hidden && panel) panel.hidden = true;
        if (!helpPanel.hidden) helpQuestion?.focus();
      });
      helpCloseButton?.addEventListener("click", () => {
        helpPanel.hidden = true;
      });
      helpSubmit?.addEventListener("click", () => {
        askUsageHelp(helpQuestion?.value || "");
      });
      helpQuestion?.addEventListener("keydown", (event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
          event.preventDefault();
          askUsageHelp(helpQuestion.value);
        }
      });
      helpPanel.addEventListener("click", (event) => {
        const button = event.target?.closest?.("[data-jrc-help-question]");
        if (button) {
          const question = button.getAttribute("data-jrc-help-question") || "";
          if (helpQuestion) helpQuestion.value = question;
          askUsageHelp(question);
        }
      });
    }
  }

  function init() {
    ensurePwaHead();
    enhanceTables();
    enhanceActionGroups();
    ensureFloatingHome();
    hydrateUsageGuidesFromCloud();
    const runDeferredEnhancements = () => {
      ensureSectionDock();
      ensureFeedbackDock();
      enhanceFormFocus();
    };
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(runDeferredEnhancements, { timeout: 1200 });
    } else {
      window.setTimeout(runDeferredEnhancements, 320);
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
