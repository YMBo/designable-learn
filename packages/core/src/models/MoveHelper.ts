import { Operation } from './Operation'
import { TreeNode } from './TreeNode'
import { observable, define, action } from '@formily/reactive'
import {
  calcDistanceOfPointToRect,
  calcDistancePointToEdge,
  isNearAfter,
  isPointInRect,
  IPoint,
  Rect,
} from '@designable/shared'
import { DragNodeEvent, DropNodeEvent } from '../events'
import { Viewport } from './Viewport'
import { CursorDragType } from './Cursor'

export enum ClosestPosition {
  Before = 'BEFORE',
  ForbidBefore = 'FORBID_BEFORE',
  After = 'After',
  ForbidAfter = 'FORBID_AFTER',
  Upper = 'UPPER',
  ForbidUpper = 'FORBID_UPPER',
  Under = 'UNDER',
  ForbidUnder = 'FORBID_UNDER',
  Inner = 'INNER',
  ForbidInner = 'FORBID_INNER',
  InnerAfter = 'INNER_AFTER',
  ForbidInnerAfter = 'FORBID_INNER_AFTER',
  InnerBefore = 'INNER_BEFORE',
  ForbidInnerBefore = 'FORBID_INNER_BEFORE',
  Forbid = 'FORBID',
}

export interface IMoveHelperProps {
  operation: Operation
}

export interface IMoveHelperDragStartProps {
  dragNodes: TreeNode[]
}

export interface IMoveHelperDragDropProps {
  dropNode: TreeNode
}
export interface IMoveHelperDragMoveProps {
  touchNode: TreeNode
  point: IPoint
}

export class MoveHelper {
  operation: Operation

  rootNode: TreeNode

  dragNodes: TreeNode[] = []

  touchNode: TreeNode = null

  closestNode: TreeNode = null

  activeViewport: Viewport = null

  viewportClosestRect: Rect = null

  outlineClosestRect: Rect = null

  viewportClosestOffsetRect: Rect = null

  outlineClosestOffsetRect: Rect = null

  viewportClosestDirection: ClosestPosition = null

  outlineClosestDirection: ClosestPosition = null

  dragging = false

  constructor(props: IMoveHelperProps) {
    this.operation = props.operation
    this.rootNode = this.operation.tree
    this.makeObservable()
  }

  get cursor() {
    return this.operation.engine.cursor
  }

  get viewport() {
    return this.operation.workspace.viewport
  }

  get outline() {
    return this.operation.workspace.outline
  }

  get hasDragNodes() {
    return this.dragNodes.length > 0
  }

  get closestDirection() {
    if (this.activeViewport === this.outline) {
      return this.outlineClosestDirection
    }
    return this.viewportClosestDirection
  }

  getClosestLayout(viewport: Viewport) {
    return viewport.getValidNodeLayout(this.closestNode)
  }

  // 计算最近可插入的位置
  calcClosestPosition(point: IPoint, viewport: Viewport): ClosestPosition {
    const closestNode = this.closestNode
    if (!closestNode || !viewport.isPointInViewport(point))
      return ClosestPosition.Forbid
    const closestRect = viewport.getValidNodeRect(closestNode)
    const isInline = this.getClosestLayout(viewport) === 'horizontal'
    if (!closestRect) {
      return
    }
    const isAfter = isNearAfter(
      point,
      closestRect,
      viewport.moveInsertionType === 'block' ? false : isInline
    )
    const getValidParent = (node: TreeNode) => {
      if (!node) return
      if (node.parent?.allowSibling(this.dragNodes)) return node.parent
      return getValidParent(node.parent)
    }
    if (isPointInRect(point, closestRect, viewport.moveSensitive)) {
      if (!closestNode.allowAppend(this.dragNodes)) {
        if (!closestNode.allowSibling(this.dragNodes)) {
          const parentClosestNode = getValidParent(closestNode)
          if (parentClosestNode) {
            this.closestNode = parentClosestNode
          }
          if (isInline) {
            if (parentClosestNode) {
              if (isAfter) {
                return ClosestPosition.After
              }
              return ClosestPosition.Before
            }
            if (isAfter) {
              return ClosestPosition.ForbidAfter
            }
            return ClosestPosition.ForbidBefore
          } else {
            if (parentClosestNode) {
              if (isAfter) {
                return ClosestPosition.Under
              }
              return ClosestPosition.Upper
            }
            if (isAfter) {
              return ClosestPosition.ForbidUnder
            }
            return ClosestPosition.ForbidUpper
          }
        } else {
          if (isInline) {
            return isAfter ? ClosestPosition.After : ClosestPosition.Before
          } else {
            return isAfter ? ClosestPosition.Under : ClosestPosition.Upper
          }
        }
      }
      if (closestNode.contains(...this.dragNodes)) {
        if (isAfter) {
          return ClosestPosition.InnerAfter
        }
        return ClosestPosition.InnerBefore
      } else {
        return ClosestPosition.Inner
      }
    } else if (closestNode === closestNode.root) {
      return isAfter ? ClosestPosition.InnerAfter : ClosestPosition.InnerBefore
    } else {
      if (!closestNode.allowSibling(this.dragNodes)) {
        const parentClosestNode = getValidParent(closestNode)
        if (parentClosestNode) {
          this.closestNode = parentClosestNode
        }
        if (isInline) {
          if (parentClosestNode) {
            if (isAfter) {
              return ClosestPosition.After
            }
            return ClosestPosition.Before
          }
          return isAfter
            ? ClosestPosition.ForbidAfter
            : ClosestPosition.ForbidBefore
        } else {
          if (parentClosestNode) {
            if (isAfter) {
              return ClosestPosition.Under
            }
            return ClosestPosition.Upper
          }
          return isAfter
            ? ClosestPosition.ForbidUnder
            : ClosestPosition.ForbidUpper
        }
      }
      if (isInline) {
        return isAfter ? ClosestPosition.After : ClosestPosition.Before
      } else {
        return isAfter ? ClosestPosition.Under : ClosestPosition.Upper
      }
    }
  }

  /**
   * 获取与point最接近的treeNode节点
   * @param point
   * @param viewport
   * @returns
   */
  calcClosestNode(point: IPoint, viewport: Viewport): TreeNode {
    // touchNode 就是当前鼠标在中间工作区命中的tree Node
    if (this.touchNode) {
      // 通过querySelectorAll获取treeNode对应的元素并通过getBoundingClientRect获取元素定位信息
      const touchNodeRect = viewport.getValidNodeRect(this.touchNode)
      if (!touchNodeRect) return
      // 如果touchNode有子元素
      if (this.touchNode?.children?.length) {
        // 计算point到边touchNodeRect的最小距离
        const touchDistance = calcDistancePointToEdge(point, touchNodeRect)
        let minDistance = touchDistance
        let minDistanceNode = this.touchNode
        // 循环touchNode下的所有子节点,找出与当前point距离子元素minDistanceNode
        this.touchNode.eachChildren((node) => {
          const rect = viewport.getElementRectById(node.id)
          if (!rect) return
          const distance = isPointInRect(point, rect, viewport.moveSensitive)
            ? 0
            : calcDistanceOfPointToRect(point, rect)
          if (distance <= minDistance) {
            minDistance = distance
            minDistanceNode = node
          }
        })
        // 返回与point最近的子treeNode节点
        return minDistanceNode
      } else {
        // 如果没有子节点则直接返回touchNode
        return this.touchNode
      }
    }
    return this.operation.tree
  }

  /**
   * 返回可插入范围
   */
  calcClosestRect(viewport: Viewport, closestDirection: ClosestPosition): Rect {
    const closestNode = this.closestNode
    if (!closestNode || !closestDirection) return
    // 返回当前热区的rect范围
    const closestRect = viewport.getValidNodeRect(closestNode)
    if (
      closestDirection === ClosestPosition.InnerAfter ||
      closestDirection === ClosestPosition.InnerBefore
    ) {
      // 如果是插入到closestNode内部，则遍历closestNode子项返回rect
      return viewport.getChildrenRect(closestNode)
    } else {
      return closestRect
    }
  }

  calcClosestOffsetRect(
    viewport: Viewport,
    closestDirection: ClosestPosition
  ): Rect {
    const closestNode = this.closestNode
    if (!closestNode || !closestDirection) return
    const closestRect = viewport.getValidNodeOffsetRect(closestNode)
    if (
      closestDirection === ClosestPosition.InnerAfter ||
      closestDirection === ClosestPosition.InnerBefore
    ) {
      return viewport.getChildrenOffsetRect(closestNode)
    } else {
      return closestRect
    }
  }

  // 在useDragDropEffect调用的
  dragStart(props: IMoveHelperDragStartProps) {
    // 拿到的是当前拖拽node的elements内容
    const nodes = TreeNode.filterDraggable(props?.dragNodes)
    console.log('nnn sourceId dragStart', nodes)
    if (nodes.length) {
      // 拖拽的节点
      this.dragNodes = nodes
      // 触发个事件，实际触发的是effects注册的内容
      // 目前看代码 没有注册，这步相当于啥都没干
      this.trigger(
        new DragNodeEvent({
          //目标节点 ，this.operation.tree这是根节点
          target: this.operation.tree,
          // 拖拽的节点
          source: this.dragNodes,
        })
      )

      // 将中间工作台所有的node缓存到nodeElementsStore中
      this.viewport.cacheElements()
      // 设置当前抓取状态
      this.cursor.setDragType(CursorDragType.Move)
      // 标记
      this.dragging = true
    }
  }

  dragMove(props: IMoveHelperDragMoveProps) {
    const { point, touchNode } = props
    if (!this.dragging) return
    // 如果在大纲树区域内
    if (this.outline.isPointInViewport(point, false)) {
      this.activeViewport = this.outline
      // 目标区域的node实例
      this.touchNode = touchNode
      this.closestNode = this.calcClosestNode(point, this.outline)
    } else if (this.viewport.isPointInViewport(point, false)) {
      // 如果在工作区
      this.activeViewport = this.viewport
      //
      this.touchNode = touchNode
      // 获取与point最接近的treeNode节
      this.closestNode = this.calcClosestNode(point, this.viewport)
    }

    // 必须在大纲区或中间工作台才生效
    if (!this.activeViewport) return

    // 这一步是为了找可插入位置
    // 大纲区
    if (this.activeViewport === this.outline) {
      this.outlineClosestDirection = this.calcClosestPosition(
        point,
        this.outline
      )

      this.viewportClosestDirection = this.outlineClosestDirection
    } else {
      // 工作台
      this.viewportClosestDirection = this.calcClosestPosition(
        point,
        this.viewport
      )
      this.outlineClosestDirection = this.viewportClosestDirection
    }

    if (this.outline.mounted) {
      // 相对于当前大纲树的rect信息
      this.outlineClosestRect = this.calcClosestRect(
        this.outline,
        this.outlineClosestDirection
      )
      // 相对于视口的位置信息
      this.outlineClosestOffsetRect = this.calcClosestOffsetRect(
        this.outline,
        this.outlineClosestDirection
      )
    }
    if (this.viewport.mounted) {
      // 相对于当前工作台的rect信息
      this.viewportClosestRect = this.calcClosestRect(
        this.viewport,
        this.viewportClosestDirection
      )
      // 相对于视口的位置信息
      this.viewportClosestOffsetRect = this.calcClosestOffsetRect(
        this.viewport,
        this.viewportClosestDirection
      )
    }
  }

  dragDrop(props: IMoveHelperDragDropProps) {
    this.trigger(
      new DropNodeEvent({
        target: this.operation.tree,
        source: props?.dropNode,
      })
    )
  }

  dragEnd() {
    this.dragging = false
    this.dragNodes = []
    this.touchNode = null
    this.closestNode = null
    this.activeViewport = null
    this.outlineClosestDirection = null
    this.outlineClosestOffsetRect = null
    this.outlineClosestRect = null
    this.viewportClosestDirection = null
    this.viewportClosestOffsetRect = null
    this.viewportClosestRect = null
    this.viewport.clearCache()
  }

  trigger(event: any) {
    if (this.operation) {
      return this.operation.dispatch(event)
    }
  }

  makeObservable() {
    define(this, {
      dragging: observable.ref,
      dragNodes: observable.ref,
      touchNode: observable.ref,
      closestNode: observable.ref,
      outlineClosestDirection: observable.ref,
      outlineClosestOffsetRect: observable.ref,
      outlineClosestRect: observable.ref,
      viewportClosestDirection: observable.ref,
      viewportClosestOffsetRect: observable.ref,
      viewportClosestRect: observable.ref,
      dragStart: action,
      dragMove: action,
      dragEnd: action,
    })
  }
}
