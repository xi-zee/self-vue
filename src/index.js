import { computed, effect, ref } from '@vue/reactivity';

import createRenderer, { Text, Comment, Fragment } from '@/compiler/index.js';

import { selfSetAttribute } from '@/utils/dom.js';
import { resolveClass, resolveStyle } from '@/utils/style.js';

import './index.scss';

// 创建一个渲染器函数，基于浏览器环境
const { render } = createRenderer({
    insert: (el, parent, anchor = null) => {
        parent.insertBefore(el, anchor);
    },
    createElement: (type) => document.createElement(type),
    createTextNode: (text) => document.createTextNode(text),
    createComment: (text) => document.createComment(text),
    setElementText: (el, text) => {
        el.textContent = text;
    },
    patchProps: selfSetAttribute,
});
/**
 * @description 根节点
 */
const ROOT = document.getElementById('root');

const count = ref(0);

const MyComponent = () => ({
    type: 'div',
    props: {
        style: resolveStyle('margin-left: 20px;font-size: 16px;cursor: pointer;'),
        onClick: () => {
            confirm('click me - function component');
        },
    },
    children: 'click me - function component'
})

const list = ref([
    { id: 1, name: 'foo' },
    { id: 2, name: 'bar' },
    { id: 3, name: 'baz' },
    { id: 4, name: 'qux' },
]);

const someVnode = computed(() => ({
    type: 'ul',
    key: 'the-ul',
    children: list.value.map(item => ({
        type: 'li',
        key: item.id,
        props: {
            style: resolveStyle('color: red;'),
        },
        children: item.name,
    })),
}))

const vnode = () => ({
    type: 'div',
    key: 'the-div',
    props: {
        style: resolveStyle('font-size: 16px;cursor: pointer;'),
        class: resolveClass({
            'container': true,
            'container-active': count.value > 0,
        }),
    },
    children: [
        {
            type: 'div',
            key: 'the-div-child-1',
            props: {
                style: resolveStyle('color: red;margin: 12px 0 12px 12px;height: 24px;'),
                class: resolveClass({
                    'child': true,
                    'child-active': count.value > 0,
                }),
            },
            children: count.value,
        },
        {
            type: 'button',
            props: {
                style: resolveStyle('margin-left: 10px;'),
                onClick: () => {
                    count.value++;
                },
                type: 'button',
            },
            children: 'add',
        },
        {
            type: 'button',
            key: 'the-button-minus',
            props: {
                style: resolveStyle({
                    marginLeft: '12px',
                }),
                onClick: () => {
                    count.value--;
                },
                type: 'button',
            },
            children: 'minus',
        },
        {
            type: Comment,
            key: 'the-comment',
            children: '注释',
        },
        {
            type: Fragment,
            key: 'the-fragment',
            children: [
                {
                    type: Text,
                    key: 'the-text-1',
                    children: '文本节点1',
                },
                {
                    type: Text,
                    key: 'the-text-2',
                    children: '文本节点2',
                },
            ],
        },
        {
            type: MyComponent,
            key: 'the-my-component',
        },
        someVnode.value,
        {
            type: 'button',
            key: 'the-button-reverse',
            props: {
                onClick: () => {
                    const length = list.value.length + 1;
                    list.value = [...[...list.value].reverse(), { id: length, name: `new item ${length}` }];  
                },
                type: 'button',
            },
            children: 'reverse list add new item',
        }
    ],
});

effect(() => {
    render(vnode(), ROOT);
})
