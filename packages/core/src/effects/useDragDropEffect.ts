import {
  Engine,
  ClosestPosition,
  CursorType,
  CursorDragType,
  TreeNode,
} from '../models'
import {
  DragStartEvent,
  DragMoveEvent,
  DragStopEvent,
  ViewportScrollEvent,
} from '../events'
import { Point } from '@designable/shared'

export const useDragDropEffect = (engine: Engine) => {
  // 订阅拖拽开始事件，当拖拽开始时执行回调函数
  engine.subscribeTo(DragStartEvent, (event) => {
    // 如果光标类型不是正常类型，则直接返回，不处理此次拖拽开始事件
    if (engine.cursor.type !== CursorType.Normal) return
    // 从dispatch穿过来的event上的target获取dom
    const target = event.data.target as HTMLElement
    // 查找包含 nodeIdAttrName、sourceIdAttrName 或 outlineNodeIdAttrName 属性的最近祖先元素
    // 星号表示任意元素类型
    // *[attr] 属性选择器
    // sourceIdAttrName就是左侧物料区绑定的属性data-designer-source-id
    // 这一步获取的其实就是物料区的div
    const el = target?.closest(`
         *[${engine.props.nodeIdAttrName}],
         *[${engine.props.sourceIdAttrName}],
         *[${engine.props.outlineNodeIdAttrName}]
        `)

    // 中间工作台选中元素的辅助框上的拖拽icon区域
    const handler = target?.closest(
      `*[${engine.props.nodeDragHandlerAttrName}]`
    )

    // 在中间工作台选中组件出现的蓝色框框元素
    const helper = handler?.closest(
      `*[${engine.props.nodeSelectionIdAttrName}]`
    )

    // 如果没有找到有效的元素（即 el 没有 getAttribute 方法）且没有找到拖拽处理程序元素，则直接返回
    if (!el?.getAttribute && !handler) return
    // 从 el 元素中获取 sourceIdAttrName 属性的值
    const sourceId = el?.getAttribute(engine.props.sourceIdAttrName)
    // 从 el 元素中获取 outlineNodeIdAttrName 属性的值
    const outlineId = el?.getAttribute(engine.props.outlineNodeIdAttrName)
    // 从 helper 元素中获取 nodeSelectionIdAttrName 属性的值
    const handlerId = helper?.getAttribute(engine.props.nodeSelectionIdAttrName)
    // 从 el 元素中获取 nodeIdAttrName 属性的值
    const nodeId = el?.getAttribute(engine.props.nodeIdAttrName)
    // 打印调试信息，包含获取到的各种 ID
    console.log('========', { nodeId, outlineId, handlerId })
    // 遍历引擎工作区中的每个工作区
    engine.workbench.eachWorkspace((currentWorkspace) => {
      // 获取当前工作区的操作对象
      const operation = currentWorkspace.operation
      // 获取操作对象中的移动辅助器
      const moveHelper = operation.moveHelper
      // 如果存在 nodeId、outlineId 或 handlerId
      if (nodeId || outlineId || handlerId) {
        // 根据这些 ID 查找对应的节点
        const node = engine.findNodeById(outlineId || nodeId || handlerId)
        // 打印调试信息，包含找到的节点
        console.log('nnn node', node)
        // 如果找到了节点
        if (node) {
          // 如果节点不允许被拖拽，则直接返回
          if (!node.allowDrag()) return
          // 如果节点是根节点，则直接返回
          if (node === node.root) return
          // 过滤出所有允许被拖拽的选中节点
          const validSelected = engine
            .getAllSelectedNodes()
            .filter((node) => node.allowDrag())
          // 如果这些有效选中节点中包含当前节点
          if (validSelected.some((selectNode) => selectNode === node)) {
            // 调用移动辅助器的 dragStart 方法，开始拖拽排序后的有效选中节点
            moveHelper.dragStart({ dragNodes: TreeNode.sort(validSelected) })
          } else {
            // 否则，调用移动辅助器的 dragStart 方法，开始拖拽当前节点
            moveHelper.dragStart({ dragNodes: [node] })
          }
        }
      } else if (sourceId) {
        // 如果没有上述 ID 但存在 sourceId，则根据 sourceId 查找对应的节点
        const sourceNode = engine.findNodeById(sourceId)
        // 打印调试信息，包含找到的源节点
        console.log('nnn sourceId', sourceNode)
        // 如果找到了源节点
        if (sourceNode) {
          // 调用移动辅助器的 dragStart 方法，开始拖拽源节点
          moveHelper.dragStart({ dragNodes: [sourceNode] })
        }
      }
    })
    // 设置光标样式为移动样式
    engine.cursor.setStyle('move')
  })

  engine.subscribeTo(DragMoveEvent, (event) => {
    if (engine.cursor.type !== CursorType.Normal) return
    if (engine.cursor.dragType !== CursorDragType.Move) return
    const target = event.data.target as HTMLElement

    // 目标区域找中间工作台或者大纲树的物料
    const el = target?.closest(`
      *[${engine.props.nodeIdAttrName}],
      *[${engine.props.outlineNodeIdAttrName}]
    `)
    // 鼠标位置
    const point = new Point(event.data.topClientX, event.data.topClientY)
    // 中间工作台对应元素的nodeid
    const nodeId = el?.getAttribute(engine.props.nodeIdAttrName)
    // 大纲树对应元素的nodeid
    const outlineId = el?.getAttribute(engine.props.outlineNodeIdAttrName)

    engine.workbench.eachWorkspace((currentWorkspace) => {
      const operation = currentWorkspace.operation
      const moveHelper = operation.moveHelper
      const dragNodes = moveHelper.dragNodes
      const tree = operation.tree
      if (!dragNodes.length) return
      // 从tree store中找到这个node
      const touchNode = tree.findById(outlineId || nodeId)
      console.log('movemove', { touchNode, outlineId, nodeId })
      // 将坐标和虚拟node传入触发moveHelper的移动
      moveHelper.dragMove({
        point,
        touchNode,
      })
    })
  })

  engine.subscribeTo(ViewportScrollEvent, (event) => {
    if (engine.cursor.type !== CursorType.Normal) return
    if (engine.cursor.dragType !== CursorDragType.Move) return
    const point = new Point(
      engine.cursor.position.topClientX,
      engine.cursor.position.topClientY
    )
    const currentWorkspace =
      event?.context?.workspace ?? engine.workbench.activeWorkspace
    if (!currentWorkspace) return
    const operation = currentWorkspace.operation
    const moveHelper = operation.moveHelper
    if (!moveHelper.dragNodes.length) return
    const tree = operation.tree
    const viewport = currentWorkspace.viewport
    const outline = currentWorkspace.outline
    const viewportTarget = viewport.elementFromPoint(point)
    const outlineTarget = outline.elementFromPoint(point)
    const viewportNodeElement = viewportTarget?.closest(`
      *[${engine.props.nodeIdAttrName}],
      *[${engine.props.outlineNodeIdAttrName}]
    `)
    const outlineNodeElement = outlineTarget?.closest(`
    *[${engine.props.nodeIdAttrName}],
    *[${engine.props.outlineNodeIdAttrName}]
  `)
    const nodeId = viewportNodeElement?.getAttribute(
      engine.props.nodeIdAttrName
    )
    const outlineNodeId = outlineNodeElement?.getAttribute(
      engine.props.outlineNodeIdAttrName
    )
    const touchNode = tree.findById(outlineNodeId || nodeId)
    moveHelper.dragMove({ point, touchNode })
  })

  engine.subscribeTo(DragStopEvent, () => {
    if (engine.cursor.type !== CursorType.Normal) return
    if (engine.cursor.dragType !== CursorDragType.Move) return
    engine.workbench.eachWorkspace((currentWorkspace) => {
      const operation = currentWorkspace.operation
      const moveHelper = operation.moveHelper
      const dragNodes = moveHelper.dragNodes
      const closestNode = moveHelper.closestNode
      const closestDirection = moveHelper.closestDirection
      console.log('closestDirection', closestNode, closestDirection)
      const selection = operation.selection
      if (!dragNodes.length) return
      if (dragNodes.length && closestNode && closestDirection) {
        if (
          closestDirection === ClosestPosition.After ||
          closestDirection === ClosestPosition.Under
        ) {
          if (closestNode.allowSibling(dragNodes)) {
            selection.batchSafeSelect(
              closestNode.insertAfter(
                ...TreeNode.filterDroppable(dragNodes, closestNode.parent)
              )
            )
          }
        } else if (
          closestDirection === ClosestPosition.Before ||
          closestDirection === ClosestPosition.Upper
        ) {
          if (closestNode.allowSibling(dragNodes)) {
            selection.batchSafeSelect(
              closestNode.insertBefore(
                ...TreeNode.filterDroppable(dragNodes, closestNode.parent)
              )
            )
          }
        } else if (
          closestDirection === ClosestPosition.Inner ||
          closestDirection === ClosestPosition.InnerAfter
        ) {
          if (closestNode.allowAppend(dragNodes)) {
            selection.batchSafeSelect(
              closestNode.append(
                ...TreeNode.filterDroppable(dragNodes, closestNode)
              )
            )
            moveHelper.dragDrop({ dropNode: closestNode })
          }
        } else if (closestDirection === ClosestPosition.InnerBefore) {
          if (closestNode.allowAppend(dragNodes)) {
            selection.batchSafeSelect(
              closestNode.prepend(
                ...TreeNode.filterDroppable(dragNodes, closestNode)
              )
            )
            moveHelper.dragDrop({ dropNode: closestNode })
          }
        }
      }
      moveHelper.dragEnd()
    })
    engine.cursor.setStyle('')
  })
}
