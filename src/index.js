import { computed, effect, ref } from '@vue/reactivity';

import createRenderer, { Text, Comment, Fragment, Teleport } from '@/compiler/index.js';

import { randomColor as getRandomColor } from '@/utils/index.js';
import { selfSetAttribute } from '@/utils/dom.js';
import { resolveClass, resolveStyle } from '@/utils/style.js';

import './index.scss';

// 创建一个渲染器函数，基于浏览器环境
const { render, onMounted, defineAsyncComponent, KeepAlive } = createRenderer({
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
    nextFrame: requestAnimationFrame,
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
            setTimeout(() => {
                randomColor.value = getRandomColor();  
            }, 3000);
        })

        return () => {
            return {
                type: 'div',
                props: {
                    style: resolveStyle('margin: 8px 16px; font-size: 16px; user-select: none;'),
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
                        props: {
                            onClick: () => {
                                randomColor.value = getRandomColor();
                                emit('change', randomColor.value);
                            },
                            style: resolveStyle('cursor: pointer; user-select: none;'),
                        },
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

function FuncComponent(props) {
    return {
        type: 'div',
        key: 'the-func-component',
        props: {
            style: resolveStyle('margin-left: 12px;'),
        },
        children: [
            {
                type: 'p',
                key: 'the-func-component-child-2',
                props: {
                    style: resolveStyle(`color: ${props.color};`),
                },
                children: props.content,
            },
            {
                type: Text,
                key: 'the-func-component-child-3',
                children: '#####################',
            },
        ]
    }
}

FuncComponent.props = {
    color: {
        type: String,
        default: 'red',
    },
    content: {
        type: String,
        default: 'default content',
    },
}

const AsyncComponent = () => import('./compiler/test/demo1.js');

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
        style: resolveStyle('font-size: 16px'),
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
                style: resolveStyle('margin-left: 12px;'),
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
        {
            type: FuncComponent,
            key: 'the-func-component',
            props: {
                // title: 'is a function component',
                color: getRandomColor(),
                content: 'this is a function component',
            },
        },
        {
            type: KeepAlive,
            key: 'the-keep-alive',
            props: {
                include: new RegExp('AsyncComponent'),
            },
            children: {
                default() {
                    return {
                        type: defineAsyncComponent({
                            loader: AsyncComponent,
                        }),
                        key: 'the-async-component',
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
        },
        // {
        //     type: defineAsyncComponent({
        //         loader: () => new Promise((resolve, reject) => {
        //             setTimeout(() => {
        //                 reject('加载失败!')
        //             }, 1000)
        //         }),
        //         errorComponent: {
        //             name: 'ErrorComponent',
        //             props: {
        //                 error: {
        //                     type: Error,
        //                 }
        //             },
        //             setup(props) {
        //                 return () => {
        //                     return {
        //                         type: 'div',
        //                         key: 'the-async-component-error',
        //                         children: '加载失败',
        //                     }
        //                 }
        //             }
        //         },
        //         loadingComponent: {
        //             name: 'loadingComponent',
        //             props: {
        //                 style: resolveStyle({
                            
        //                 })
        //             },
        //             setup(props) {
        //                 return () => {
        //                     return {
        //                         type: 'div',
        //                         key: 'the-async-component-loading',
        //                         children: '加载中...',
        //                     }
        //                 }
        //             }
        //         },
        //         onError: (retry, fail, retries) => {
        //             if (retries >= 2) {
        //                 fail();
        //                 return;
        //             }
        //             setTimeout(() => {
        //                 retry();
        //             }, 0);
        //         }
        //     }),
        //     key: 'normal-async-component',
        // }
    ],
});

effect(() => {
    render(vnode(), ROOT);
})
