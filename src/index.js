import { computed, effect, ref } from '@vue/reactivity';

import createRenderer, { Text, Comment, Fragment } from '@/compiler/index.js';

import { randomColor as getRandomColor } from '@/utils/index.js';
import { selfSetAttribute } from '@/utils/dom.js';
import { resolveClass, resolveStyle } from '@/utils/style.js';

import './index.scss';

// 创建一个渲染器函数，基于浏览器环境
const { render, onMounted } = createRenderer({
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

const MyComponent = {
    name: 'MyComponent',
    props: {
        title: {
            type: String,
            default: 'default title',
        },
    },

    setup(props, { emit, slots }) {
        const randomColor = ref(getRandomColor());
        const { title } = props;

        onMounted(() => {
            console.log('callback 1')
            setTimeout(() => {
                randomColor.value = getRandomColor();  
            }, 3000);
        })

        onMounted(() => {
            console.log('callback 2')
        })

        return () => {
            return {
                type: 'div',
                props: {
                    style: resolveStyle('margin: 8px 16px; font-size: 16px; cursor: pointer; user-select: none;'),
                    onClick: () => {
                        randomColor.value = getRandomColor();
                        emit('change', randomColor.value);
                    },
                },
                children: [
                    {
                        type: 'div',
                        key: 'the-my-component-child-1',
                        children: `props: ${title}`,
                    },
                    {
                        type: 'div',
                        key: 'the-my-component-child-2',
                        props: {
                            style: resolveStyle(`color: ${randomColor.value};`),
                        },
                        children: `data: ${randomColor.value}`,
                    },
                    // 组件内定义插槽会被编译成如下形式
                    {
                        type: 'div',
                        key: 'the-my-component-slot-header',
                        children: slots.header ? [slots.header()] : null,
                    },
                    {
                        type: 'div',
                        key: 'the-my-component-slot-body',
                        children: slots.body ? [slots.body()] : null,
                    },
                    {
                        type: 'div',
                        key: 'the-my-component-slot-footer',
                        children: slots.footer ? [slots.footer()] : null,
                    },
                ],
            }
        }
    },

    // * 选项式 API 就是帮你 创建了一个代理, this 指向代理对象 里面让你能访问 props、data、computed、methods 等等
    // data() {
    //     return {
    //         randomColor: getRandomColor(),
    //     }
    // },
    // render() {
    //     return {
    //         type: 'div',
    //         props: {
    //             style: resolveStyle('margin: 8px 16px; font-size: 16px; cursor: pointer; user-select: none;'),
    //             onClick: () => {
    //                 this.randomColor = getRandomColor();
    //             },
    //         },
    //         children: [
    //             {
    //                 type: 'div',
    //                 key: 'the-my-component-child-1',
    //                 children: `props: ${this.title}`,
    //             },
    //             {
    //                 type: 'div',
    //                 key: 'the-my-component-child-2',
    //                 props: {
    //                     style: resolveStyle(`color: ${this.randomColor};`),
    //                 },
    //                 children: `data: ${this.randomColor}`,
    //             },
    //             // 组件内定义插槽会被编译成如下形式
    //             {
    //                 type: 'div',
    //                 key: 'the-my-component-slot-header',
    //                 children: this.$slots.header ? [this.$slots.header()] : null,
    //             },
    //             {
    //                 type: 'div',
    //                 key: 'the-my-component-slot-body',
    //                 children: this.$slots.body ? [this.$slots.body()] : null,
    //             },
    //             {
    //                 type: 'div',
    //                 key: 'the-my-component-slot-footer',
    //                 children: this.$slots.footer ? [this.$slots.footer()] : null,
    //             },
    //         ],
    //     }
    // }
}

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
            style: resolveStyle(`color: ${getRandomColor()};`),
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
            props: {
                title: 'is a customize component',
                // 事件emit会被 compiler 编译成如下形式
                // @change => onChange
                onChange: (...args) => {
                    console.log('handle', ...args);
                },
            },
            // 父组件使用插槽会被编译成如下形式
            children: {
                header() {
                    return {
                        type: 'h3',
                        key: 'the-my-component-slot-header',
                        children: '我是标题',
                    }
                },
                body() {
                    return {
                        type: 'section',
                        key: 'the-my-component-slot-body',
                        children: '我是主要内容',
                    }
                },
                footer() {
                    return {
                        type: 'footer',
                        key: 'the-my-component-slot-footer',
                        children: '我是底部',
                    }
                },
            }
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
                style: resolveStyle({
                    marginLeft: '12px',
                }),
            },
            children: 'reverse list add new item',
        }
    ],
});

effect(() => {
    render(vnode(), ROOT);
})

