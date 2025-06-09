import { each } from '@designable/shared'
import { Path } from '@formily/path'
import { observable } from '@formily/reactive'
import {
  IDesignerBehaviorStore,
  IDesignerIconsStore,
  IDesignerLocaleStore,
  IDesignerLanguageStore,
  IDesignerBehaviors,
  IDesignerLocales,
  IDesignerIcons,
  IBehaviorLike,
  IBehavior,
} from './types'
import { mergeLocales, lowerSnake, getBrowserLanguage } from './internals'
import { isBehaviorHost } from './externals'
import { TreeNode } from './models'
import { isBehaviorList } from './externals'

const getISOCode = (language: string) => {
  let isoCode = DESIGNER_LANGUAGE_STORE.value
  let lang = lowerSnake(language)
  if (DESIGNER_LOCALES_STORE.value[lang]) {
    return lang
  }
  each(DESIGNER_LOCALES_STORE.value, (_, key: string) => {
    if (key.indexOf(lang) > -1 || String(lang).indexOf(key) > -1) {
      isoCode = key
      return false
    }
  })
  return isoCode
}

/**
 * 返回一个队列，队列的内容是每个物料的Behavior子项，其中顺序为[extends, ... ,behavior]
 * @param target 这个就是一个空数组
 * @param sources 这个物料合集 对象
 */
const reSortBehaviors = (target: IBehavior[], sources: IDesignerBehaviors) => {
  // 判断target中是否包含传入的behavior
  const findTargetBehavior = (behavior: IBehavior) => target.includes(behavior)

  // 遍历每个物料的Behavior属性
  const findSourceBehavior = (name: string) => {
    // 遍历所有物料
    for (let key in sources) {
      // 拿到Behavior属性
      const { Behavior } = sources[key]
      // 从所有物料的Behavior属性中找到name等于传入name的Behavior
      for (let i = 0; i < Behavior.length; i++) {
        if (Behavior[i].name === name) return Behavior[i]
      }
    }
  }

  // 遍历每个sources，这个sources就是外面传进来的物料合集props.components 对象
  each(sources, (item) => {
    if (!item) return
    /**
     * 1、判断单个物料上是否有Behavior字段
     * 2、判断Behavior字段是否为数组
     * 3、判断Behavior每个子项的name,selector,extends,designerProps,designerLocales属性是否存在
     */
    if (!isBehaviorHost(item)) return

    const { Behavior } = item

    // 循环物料上的Behavior
    each(Behavior, (behavior) => {
      // 如果target上已经存在了，则退出
      if (findTargetBehavior(behavior)) return
      const name = behavior.name
      // 循环extends属性，这个属性是个数组。例如Input物料的声明为 extends: ['Field']
      each(behavior.extends, (dep) => {
        // 遍历每个物料的Behavior属性，找到与dep名称相同的子项，并返回
        // 可以从命名看到 extends的定位是【依赖】，这个依赖就是其他物料Behavior的某个子项
        const behavior = findSourceBehavior(dep)
        if (!behavior)
          throw new Error(`No ${dep} behavior that ${name} depends on`)
        if (!findTargetBehavior(behavior)) {
          // 将依赖插入到队列头部
          target.unshift(behavior)
        }
      })
      // 将当前behavior推入到队列末尾
      target.push(behavior)
    })
  })
}

/**存储物料的Behavior数组的 */
const DESIGNER_BEHAVIORS_STORE: IDesignerBehaviorStore = observable.ref([])

const DESIGNER_ICONS_STORE: IDesignerIconsStore = observable.ref({})

const DESIGNER_LOCALES_STORE: IDesignerLocaleStore = observable.ref({})

const DESIGNER_LANGUAGE_STORE: IDesignerLanguageStore = observable.ref(
  getBrowserLanguage()
)

const DESIGNER_GlobalRegistry = {
  setDesignerLanguage: (lang: string) => {
    DESIGNER_LANGUAGE_STORE.value = lang
  },

  setDesignerBehaviors: (behaviors: IBehaviorLike[]) => {
    DESIGNER_BEHAVIORS_STORE.value = behaviors.reduce<IBehavior[]>(
      (buf, behavior) => {
        /**
         * 1、判断单个物料上是否有Behavior字段
         * 2、判断Behavior字段是否为数组
         * 3、判断Behavior每个子项的name,selector,extends,designerProps,designerLocales属性是否存在
         */
        if (isBehaviorHost(behavior)) {
          return buf.concat(behavior.Behavior)
        } else if (isBehaviorList(behavior)) {
          return buf.concat(behavior)
        }
        return buf
      },
      []
    )
  },

  getDesignerBehaviors: (node: TreeNode) => {
    return DESIGNER_BEHAVIORS_STORE.value.filter((pattern) =>
      /** 调用的就是定义物料时候的selector，目的是从一大堆物料中获取到指定的node
       * 因为物料的定义是靠createResource函数来创建treeNode的，而Behavior的定义是【行为】与Resource不在一起
       * 所以Behavior里的selector作用就是取Resource里的TreeNode的
       * 
       * 注意 这也是分情况的，当在左边物料区域的时候，node上只有三个属性，所以从左侧物料区拖拽的时候返回的是空[]
       *  componentName: '$$ResourceNode$$',
          isSourceNode: true,
          children: source.elements || [],
       */
      pattern.selector(node)
    )
  },

  getDesignerIcon: (name: string) => {
    return DESIGNER_ICONS_STORE[name]
  },

  getDesignerLanguage: () => {
    return getISOCode(DESIGNER_LANGUAGE_STORE.value)
  },

  getDesignerMessage: (token: string, locales?: IDesignerLocales) => {
    const lang = getISOCode(DESIGNER_LANGUAGE_STORE.value)
    const locale = locales ? locales[lang] : DESIGNER_LOCALES_STORE.value[lang]
    if (!locale) {
      for (let key in DESIGNER_LOCALES_STORE.value) {
        const message = Path.getIn(
          DESIGNER_LOCALES_STORE.value[key],
          lowerSnake(token)
        )
        if (message) return message
      }
      return
    }
    return Path.getIn(locale, lowerSnake(token))
  },

  registerDesignerIcons: (map: IDesignerIcons) => {
    Object.assign(DESIGNER_ICONS_STORE, map)
  },

  registerDesignerLocales: (...packages: IDesignerLocales[]) => {
    packages.forEach((locales) => {
      mergeLocales(DESIGNER_LOCALES_STORE.value, locales)
    })
  },

  registerDesignerBehaviors: (...packages: IDesignerBehaviors[]) => {
    const results: IBehavior[] = []
    packages.forEach((sources) => {
      reSortBehaviors(results, sources)
    })

    console.log('registerDesignerBehaviors', { packages, results })
    if (results.length) {
      DESIGNER_BEHAVIORS_STORE.value = results
    }
  },
}

export type IDesignerRegistry = typeof DESIGNER_GlobalRegistry

export const GlobalRegistry: IDesignerRegistry = DESIGNER_GlobalRegistry
