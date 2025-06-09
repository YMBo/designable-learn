import React, { useEffect, useRef } from 'react'
import { Engine, GlobalRegistry } from '@designable/core'
import { DesignerEngineContext } from '../context'
import { IDesignerProps } from '../types'
import { GhostWidget } from '../widgets'
import { useDesigner } from '../hooks'
import { Layout } from './Layout'
import * as icons from '../icons'

// 注册图标到DESIGNER_ICONS_STORE 上
GlobalRegistry.registerDesignerIcons(icons)

export const Designer: React.FC<IDesignerProps> = (props) => {
  // 获取DesignerEngineContext上存储的值。就是为了避免重复声明引擎
  const engine = useDesigner()
  const ref = useRef<Engine>()
  useEffect(() => {
    if (props.engine) {
      if (props.engine && ref.current) {
        if (props.engine !== ref.current) {
          // 如果之前存在过engine实例，则先卸载
          ref.current.unmount()
        }
      }
      // 初始化engine mount
      props.engine.mount()
      ref.current = props.engine
    }
    return () => {
      if (props.engine) {
        props.engine.unmount()
      }
    }
  }, [props.engine])

  // 避免重复声明engine。避免多次调用Designer组件
  if (engine)
    throw new Error(
      'There can only be one Designable Engine Context in the React Tree'
    )

  return (
    <Layout {...props}>
      <DesignerEngineContext.Provider value={props.engine}>
        {props.children}

        {/* 这个就是当拖拽的时候的浮标 */}
        <GhostWidget />
      </DesignerEngineContext.Provider>
    </Layout>
  )
}

Designer.defaultProps = {
  prefixCls: 'dn-',
  theme: 'light',
}
