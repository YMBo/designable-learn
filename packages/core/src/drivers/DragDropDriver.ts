import { EventDriver } from '@designable/shared'
import { Engine } from '../models/Engine'
import { DragStartEvent, DragMoveEvent, DragStopEvent } from '../events'

const GlobalState = {
  dragging: false,
  onMouseDownAt: 0,
  startEvent: null,
  moveEvent: null,
}

export class DragDropDriver extends EventDriver<Engine> {
  mouseDownTimer = null

  startEvent: MouseEvent

  onMouseDown = (e: MouseEvent) => {
    console.log('鼠标按下', e)
    if (e.button !== 0 || e.ctrlKey || e.metaKey) {
      return
    }
    if (
      e.target['isContentEditable'] ||
      e.target['contentEditable'] === 'true'
    ) {
      return true
    }
    if (e.target?.['closest']?.('.monaco-editor')) return
    GlobalState.startEvent = e
    GlobalState.dragging = false
    GlobalState.onMouseDownAt = Date.now()
    this.batchAddEventListener('mouseup', this.onMouseUp)
    // this.batchAddEventListener('dragend', this.onMouseUp)
    // this.batchAddEventListener('dragstart', this.onStartDrag)
    this.batchAddEventListener('mousemove', this.onDistanceChange)
  }

  onMouseUp = (e: MouseEvent) => {
    console.log('eeee', e.target)
    if (GlobalState.dragging) {
      this.dispatch(
        new DragStopEvent({
          clientX: e.clientX,
          clientY: e.clientY,
          pageX: e.pageX,
          pageY: e.pageY,
          // 这个target是鼠标抬起位置的dom
          target: e.target,
          view: e.view,
        })
      )
    }

    // 允许右键
    this.batchRemoveEventListener(
      'contextmenu',
      this.onContextMenuWhileDragging,
      true
    )

    this.batchRemoveEventListener('mouseup', this.onMouseUp)
    this.batchRemoveEventListener('mousedown', this.onMouseDown)
    this.batchRemoveEventListener('dragover', this.onMouseMove)
    this.batchRemoveEventListener('mousemove', this.onMouseMove)
    this.batchRemoveEventListener('mousemove', this.onDistanceChange)
    GlobalState.dragging = false
  }

  onMouseMove = (e: MouseEvent | DragEvent) => {
    // 避免重复触发
    if (
      e.clientX === GlobalState.moveEvent?.clientX &&
      e.clientY === GlobalState.moveEvent?.clientY
    )
      return
    // 触发事件订阅，在useDragDropEffect中订阅的
    this.dispatch(
      new DragMoveEvent({
        clientX: e.clientX,
        clientY: e.clientY,
        pageX: e.pageX,
        pageY: e.pageY,
        target: e.target,
        view: e.view,
      })
    )
    GlobalState.moveEvent = e
  }

  onContextMenuWhileDragging = (e: MouseEvent) => {
    e.preventDefault()
  }

  onStartDrag = (e: MouseEvent | DragEvent) => {
    if (GlobalState.dragging) return
    console.log('onStartDrag', e)
    GlobalState.startEvent = GlobalState.startEvent || e
    this.batchAddEventListener('dragover', this.onMouseMove)
    this.batchAddEventListener('mousemove', this.onMouseMove)
    this.batchAddEventListener(
      'contextmenu',
      this.onContextMenuWhileDragging,
      true
    )
    this.dispatch(
      new DragStartEvent({
        clientX: GlobalState.startEvent.clientX,
        clientY: GlobalState.startEvent.clientY,
        pageX: GlobalState.startEvent.pageX,
        pageY: GlobalState.startEvent.pageY,
        target: GlobalState.startEvent.target,
        view: GlobalState.startEvent.view,
      })
    )
    GlobalState.dragging = true
  }

  onDistanceChange = (e: MouseEvent) => {
    // 计算鼠标从按下位置到当前位置的直线距离
    const distance = Math.sqrt(
      Math.pow(e.pageX - GlobalState.startEvent.pageX, 2) +
        Math.pow(e.pageY - GlobalState.startEvent.pageY, 2)
    )
    // 计算鼠标按下到现在经过的时间
    const timeDelta = Date.now() - GlobalState.onMouseDownAt
    // 检查是否满足触发拖拽的条件：
    // 1. 鼠标按下后经过的时间超过 10 毫秒
    // 2. 当前事件不是鼠标按下事件
    // 3. 鼠标移动的距离超过 4 个像素
    if (timeDelta > 10 && e !== GlobalState.startEvent && distance > 4) {
      // 移除鼠标移动事件监听器，避免重复触发
      this.batchRemoveEventListener('mousemove', this.onDistanceChange)
      // 调用 onStartDrag 方法，开始拖拽操作
      this.onStartDrag(e)
    }
  }

  attach() {
    this.batchAddEventListener('mousedown', this.onMouseDown, true)
  }

  detach() {
    GlobalState.dragging = false
    GlobalState.moveEvent = null
    GlobalState.onMouseDownAt = null
    GlobalState.startEvent = null
    this.batchRemoveEventListener('mousedown', this.onMouseDown, true)
    this.batchRemoveEventListener('dragstart', this.onStartDrag)
    this.batchRemoveEventListener('dragend', this.onMouseUp)
    this.batchRemoveEventListener('dragover', this.onMouseMove)
    this.batchRemoveEventListener('mouseup', this.onMouseUp)
    this.batchRemoveEventListener('mousemove', this.onMouseMove)
    this.batchRemoveEventListener('mousemove', this.onDistanceChange)
    this.batchRemoveEventListener(
      'contextmenu',
      this.onContextMenuWhileDragging,
      true
    )
  }
}
