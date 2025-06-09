import React, { Fragment, useEffect } from 'react'
import { useTree, usePrefix, useDesigner, useComponents } from '../../hooks'
import { TreeNodeContext, DesignerComponentsContext } from '../../context'
import { IDesignerComponents } from '../../types'
import { TreeNode, GlobalRegistry } from '@designable/core'
import { observer } from '@formily/reactive-react'
import cls from 'classnames'
import './styles.less'

export interface IComponentTreeWidgetProps {
  style?: React.CSSProperties
  className?: string
  components: IDesignerComponents
}

export interface ITreeNodeWidgetProps {
  node: TreeNode
  children?: React.ReactChild
}

export const TreeNodeWidget: React.FC<ITreeNodeWidgetProps> = observer(
  (props: ITreeNodeWidgetProps) => {
    const designer = useDesigner(props.node?.designerProps?.effects)
    // 从context拿到所有物料
    const components = useComponents()

    // debugger
    // 就是外面传的tree，node树的根节点
    const node = props.node
    const renderChildren = () => {
      // debugger
      if (node?.designerProps?.selfRenderChildren) return []
      return node?.children?.map((child) => {
        return <TreeNodeWidget key={child.id} node={child} />
      })
    }
    const renderProps = (extendsProps: any = {}) => {
      const props = {
        // 这里的designerProps就是组件定义preview.tsx文件中Behavior定义的designerProps
        ...node.designerProps?.defaultProps,
        ...extendsProps,
        // 这里的node props就是在物料Resource里定义的props
        ...node.props,
        ...node.designerProps?.getComponentProps?.(node),
      }
      console.log('pppp', node.props, extendsProps)
      if (node.depth === 0) {
        delete props.style
      }
      // debugger
      return props
    }
    const renderComponent = () => {
      const componentName = node.componentName
      const Component = components[componentName]
      console.log('pppp node', node)
      const dataId = {}
      // debugger
      if (Component) {
        if (designer) {
          // 给Dom挂载nodeid
          dataId[designer?.props?.nodeIdAttrName] = node.id
        }
        return React.createElement(
          Component,
          renderProps(dataId),
          ...renderChildren()
        )
      } else {
        if (node?.children?.length) {
          return <Fragment>{renderChildren()}</Fragment>
        }
      }
    }

    if (!node) return null
    if (node.hidden) return null
    // debugger

    return React.createElement(
      TreeNodeContext.Provider,
      { value: node },
      renderComponent()
    )
  }
)

export const ComponentTreeWidget: React.FC<IComponentTreeWidgetProps> =
  observer((props: IComponentTreeWidgetProps) => {
    const tree = useTree()
    const prefix = usePrefix('component-tree')
    const designer = useDesigner()
    const dataId = {}
    if (designer && tree) {
      dataId[designer?.props?.nodeIdAttrName] = tree.id
    }
    useEffect(() => {
      GlobalRegistry.registerDesignerBehaviors(props.components)
    }, [])
    return (
      <div
        style={{ ...props.style, ...tree?.props?.style }}
        className={cls(prefix, props.className)}
        {...dataId}
      >
        <DesignerComponentsContext.Provider value={props.components}>
          <TreeNodeWidget node={tree} />
        </DesignerComponentsContext.Provider>
      </div>
    )
  })

ComponentTreeWidget.displayName = 'ComponentTreeWidget'
