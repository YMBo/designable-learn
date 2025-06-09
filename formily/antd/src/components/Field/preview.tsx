import React from 'react'
import { FormPath } from '@formily/core'
import { toJS } from '@formily/reactive'
import {
  ArrayField,
  Field as InternalField,
  ObjectField,
  VoidField,
  observer,
  ISchema,
  Schema,
} from '@formily/react'
import { FormItem } from '@formily/antd'
import { each, reduce } from '@formily/shared'
import { createBehavior } from '@designable/core'
import {
  useDesigner,
  useTreeNode,
  useComponents,
  DnFC,
} from '@designable/react'
import { isArr, isStr } from '@designable/shared'
import { Container } from '../../common/Container'
import { AllLocales } from '../../locales'

Schema.silent(true)

const SchemaStateMap = {
  title: 'title',
  description: 'description',
  default: 'value',
  enum: 'dataSource',
  readOnly: 'readOnly',
  writeOnly: 'editable',
  required: 'required',
  'x-content': 'content',
  'x-value': 'value',
  'x-editable': 'editable',
  'x-disabled': 'disabled',
  'x-read-pretty': 'readPretty',
  'x-read-only': 'readOnly',
  'x-visible': 'visible',
  'x-hidden': 'hidden',
  'x-display': 'display',
  'x-pattern': 'pattern',
}

const NeedShownExpression = {
  title: true,
  description: true,
  default: true,
  'x-content': true,
  'x-value': true,
}

const isExpression = (val: any) => isStr(val) && /^\{\{.*\}\}$/.test(val)

const filterExpression = (val: any) => {
  if (typeof val === 'object') {
    const isArray = isArr(val)
    const results = reduce(
      val,
      (buf: any, value, key) => {
        if (isExpression(value)) {
          return buf
        } else {
          const results = filterExpression(value)
          if (results === undefined || results === null) return buf
          if (isArray) {
            return buf.concat([results])
          }
          buf[key] = results
          return buf
        }
      },
      isArray ? [] : {}
    )
    return results
  }
  if (isExpression(val)) {
    return
  }
  return val
}

const toDesignableFieldProps = (
  schema: ISchema,
  components: any,
  nodeIdAttrName: string,
  id: string
) => {
  const results: any = {}
  each(SchemaStateMap, (fieldKey, schemaKey) => {
    const value = schema[schemaKey]
    if (isExpression(value)) {
      if (!NeedShownExpression[schemaKey]) return
      if (value) {
        results[fieldKey] = value
        return
      }
    } else if (value) {
      results[fieldKey] = filterExpression(value)
    }
  })
  if (!components['FormItem']) {
    components['FormItem'] = FormItem
  }
  const decorator =
    schema['x-decorator'] && FormPath.getIn(components, schema['x-decorator'])
  const component =
    schema['x-component'] && FormPath.getIn(components, schema['x-component'])
  const decoratorProps = schema['x-decorator-props'] || {}
  const componentProps = schema['x-component-props'] || {}

  if (decorator) {
    results.decorator = [decorator, toJS(decoratorProps)]
  }
  if (component) {
    results.component = [component, toJS(componentProps)]
  }
  if (decorator) {
    FormPath.setIn(results['decorator'][1], nodeIdAttrName, id)
  } else if (component) {
    FormPath.setIn(results['component'][1], nodeIdAttrName, id)
  }
  results.title = results.title && (
    <span data-content-editable="title">{results.title}</span>
  )
  results.description = results.description && (
    <span data-content-editable="description">{results.description}</span>
  )
  return results
}

// 页面中渲染的组件是通过props传递下来的
/**
 * 这三个是基础组件
 * VoidField：纯布局容器，不参与数据结构。
 * ObjectField：组织嵌套对象数据（如 user.name）。
 * ArrayField：处理动态数组数据（如多个联系人）。
 * 
 * 这三个组件通过接收props来渲染对应的物料
 * 其中接收参数包括但不限于：
 * 
 * 数据与校验
name: 字段名称（支持路径，如 user.name）
type: 字段类型（string、number、object 等）
required: 是否必填
defaultValue: 默认值
validator: 自定义校验函数

 * UI 与布局
title: 字段标题
description: 字段描述
x-decorator: 装饰器组件（如 FormItem）
x-component: 渲染组件
x-component-props: 传递给组件的 props

 * 状态与事件
visible: 是否可见
editable: 是否可编辑
readOnly: 是否只读
onChange: 值变化回调
onBlur: 失焦回调
onFocus: 聚焦回调


 */

export const Field: DnFC<ISchema> = observer((props) => {
  const designer = useDesigner()
  const components = useComponents()
  // 在TreeNodeWidget组件中定义的
  const node = useTreeNode()
  if (!node) return null
  const fieldProps = toDesignableFieldProps(
    props,
    components,
    designer.props.nodeIdAttrName,
    node.id
  )
  console.log('FFFFFF', fieldProps, {
    props,
    components,
    nodeIdAttrName: designer.props.nodeIdAttrName,
    id: node.id,
  })
  if (props.type === 'object') {
    return (
      <Container>
        <ObjectField {...fieldProps} name={node.id}>
          {props.children}
        </ObjectField>
      </Container>
    )
  } else if (props.type === 'array') {
    return <ArrayField {...fieldProps} name={node.id} />
  } else if (node.props.type === 'void') {
    return (
      <VoidField {...fieldProps} name={node.id}>
        {props.children}
      </VoidField>
    )
  }
  return <InternalField {...fieldProps} name={node.id} />
})

Field.Behavior = createBehavior({
  name: 'Field',
  selector: 'Field',
  designerLocales: AllLocales.Field,
})
