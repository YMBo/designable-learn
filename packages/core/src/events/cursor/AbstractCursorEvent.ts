import { IEngineContext } from '../../types'
import { globalThisPolyfill } from '@designable/shared'

export interface ICursorEventOriginData {
  clientX: number
  clientY: number
  pageX: number
  pageY: number
  target: EventTarget
  view: Window
}

export interface ICursorEventData extends ICursorEventOriginData {
  topClientX?: number
  topClientY?: number
  topPageX?: number
  topPageY?: number
}

export class AbstractCursorEvent {
  data: ICursorEventData

  context: IEngineContext

  constructor(data: ICursorEventOriginData) {
    this.data = data || {
      clientX: 0,
      clientY: 0,
      pageX: 0,
      pageY: 0,
      target: null,
      view: globalThisPolyfill,
    }
    this.transformCoordinates()
  }

  transformCoordinates() {
    const { frameElement } = this.data?.view || {}
    // 如果是中间工作台是套在iframe中使用，则计算相对于顶层窗口的坐标信息
    if (frameElement && this.data.view !== globalThisPolyfill) {
      const frameRect = frameElement.getBoundingClientRect()
      const scale = frameRect.width / frameElement['offsetWidth']
      this.data.topClientX = this.data.clientX * scale + frameRect.x
      this.data.topClientY = this.data.clientY * scale + frameRect.y
      this.data.topPageX =
        this.data.pageX + frameRect.x - this.data.view.scrollX
      this.data.topPageY =
        this.data.pageY + frameRect.y - this.data.view.scrollY
        // 返回当前位置坐标最顶层的元素，与mousemove回调的event.target的区别就是mousemove的target是事件冒泡的目标元素，而前者是顶层元素
      const topElement = document.elementFromPoint(
        this.data.topPageX,
        this.data.topClientY
      )
      if (topElement !== frameElement) {
        this.data.target = topElement
      }
    } else {
      this.data.topClientX = this.data.clientX
      this.data.topClientY = this.data.clientY
      this.data.topPageX = this.data.pageX
      this.data.topPageY = this.data.pageY
    }
  }
}
