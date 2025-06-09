import { IEngineProps } from '../types'
import { ITreeNode, TreeNode } from './TreeNode'
import { Workbench } from './Workbench'
import { Cursor } from './Cursor'
import { Keyboard } from './Keyboard'
import { Screen, ScreenType } from './Screen'
import { Event, uid, globalThisPolyfill } from '@designable/shared'

/**
 * 设计器引擎
 */

export class Engine extends Event {
  id: string

  props: IEngineProps<Engine>

  cursor: Cursor

  workbench: Workbench

  keyboard: Keyboard

  screen: Screen

  constructor(props: IEngineProps<Engine>) {
    super(props)
    this.props = {
      ...Engine.defaultProps,
      ...props,
    }
    this.init()
    this.id = uid()
  }

  init() {
    this.workbench = new Workbench(this)
    this.screen = new Screen(this)
    this.cursor = new Cursor(this)
    this.keyboard = new Keyboard(this)
  }

  setCurrentTree(tree?: ITreeNode) {
    console.log('setCurrentTree', tree)
    if (this.workbench.currentWorkspace) {
      // 根节点
      this.workbench.currentWorkspace.operation.tree.from(tree)
    }
  }

  getCurrentTree() {
    return this.workbench?.currentWorkspace?.operation?.tree
  }

  getAllSelectedNodes() {
    let results: TreeNode[] = []
    for (let i = 0; i < this.workbench.workspaces.length; i++) {
      const workspace = this.workbench.workspaces[i]
      results = results.concat(workspace.operation.selection.selectedNodes)
    }
    return results
  }

  findNodeById(id: string) {
    return TreeNode.findById(id)
  }

  findMovingNodes(): TreeNode[] {
    const results = []
    this.workbench.eachWorkspace((workspace) => {
      workspace.operation.moveHelper.dragNodes?.forEach((node) => {
        if (!results.includes(node)) {
          results.push(node)
        }
      })
    })
    return results
  }

  createNode(node: ITreeNode, parent?: TreeNode) {
    return new TreeNode(node, parent)
  }

  mount() {
    this.attachEvents(globalThisPolyfill)
  }

  unmount() {
    this.detachEvents()
  }

  static defaultProps: IEngineProps<Engine> = {
    shortcuts: [],
    effects: [],
    drivers: [],
    // 根元素名称
    rootComponentName: 'Root',
    // 左侧物料区每个物料元素绑定的属性
    sourceIdAttrName: 'data-designer-source-id',
    // 中间工作台上元素绑定的属性
    nodeIdAttrName: 'data-designer-node-id',
    contentEditableAttrName: 'data-content-editable',
    contentEditableNodeIdAttrName: 'data-content-editable-node-id',
    clickStopPropagationAttrName: 'data-click-stop-propagation',
    // 在中间工作台选中组件出现的蓝色框框元素
    nodeSelectionIdAttrName: 'data-designer-node-helpers-id',
    // 中间工作台选中元素的蓝色辅助框上的拖拽icon区域
    nodeDragHandlerAttrName: 'data-designer-node-drag-handler',
    screenResizeHandlerAttrName: 'data-designer-screen-resize-handler',
    nodeResizeHandlerAttrName: 'data-designer-node-resize-handler',
    // 大纲树每个元素的属性
    outlineNodeIdAttrName: 'data-designer-outline-node-id',
    nodeTranslateAttrName: 'data-designer-node-translate-handler',
    defaultScreenType: ScreenType.PC,
  }
}
