import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import Toast from './Toast.vue'
import { useToastStore } from '@stores/toast'

describe('Toast Component', () => {
    beforeEach(() => {
        setActivePinia(createPinia())
    })

    it('should render without toasts', () => {
        const wrapper = mount(Toast)
        expect(wrapper.findAll('[role="alert"]')).toHaveLength(0)
    })

    it('should render success toast', () => {
        const store = useToastStore()
        store.addToast({
            type: 'success',
            title: 'Success!',
            message: 'Operation completed',
        })

        const wrapper = mount(Toast)
        expect(wrapper.text()).toContain('Success!')
        expect(wrapper.text()).toContain('Operation completed')
    })

    it('should render error toast', () => {
        const store = useToastStore()
        store.addToast({
            type: 'error',
            title: 'Error!',
            message: 'Something went wrong',
        })

        const wrapper = mount(Toast)
        expect(wrapper.text()).toContain('Error!')
        expect(wrapper.text()).toContain('Something went wrong')
    })

    it('should render warning toast', () => {
        const store = useToastStore()
        store.addToast({
            type: 'warning',
            title: 'Warning',
            message: 'Please check your input',
        })

        const wrapper = mount(Toast)
        expect(wrapper.text()).toContain('Warning')
    })

    it('should render info toast', () => {
        const store = useToastStore()
        store.addToast({
            type: 'info',
            title: 'Info',
            message: 'For your information',
        })

        const wrapper = mount(Toast)
        expect(wrapper.text()).toContain('Info')
    })

    it('should render multiple toasts', () => {
        const store = useToastStore()
        store.addToast({ type: 'success', title: 'First' })
        store.addToast({ type: 'error', title: 'Second' })
        store.addToast({ type: 'info', title: 'Third' })

        const wrapper = mount(Toast)
        expect(wrapper.text()).toContain('First')
        expect(wrapper.text()).toContain('Second')
        expect(wrapper.text()).toContain('Third')
    })

    it('should render toast without message', () => {
        const store = useToastStore()
        store.addToast({
            type: 'success',
            title: 'Quick success',
        })

        const wrapper = mount(Toast)
        expect(wrapper.text()).toContain('Quick success')
    })

    it('should call removeToast when close button clicked', async () => {
        const store = useToastStore()
        const removeSpy = vi.spyOn(store, 'removeToast')
        
        store.addToast({
            type: 'info',
            title: 'Close me',
        })

        const wrapper = mount(Toast)
        const closeButton = wrapper.find('button')
        await closeButton.trigger('click')

        expect(removeSpy).toHaveBeenCalledWith(expect.any(String))
    })

    it('should apply correct styling for success type', () => {
        const store = useToastStore()
        store.addToast({
            type: 'success',
            title: 'Styled success',
        })

        const wrapper = mount(Toast)
        const toastElement = wrapper.find('.bg-green-50')
        expect(toastElement.exists()).toBe(true)
    })

    it('should apply correct styling for error type', () => {
        const store = useToastStore()
        store.addToast({
            type: 'error',
            title: 'Styled error',
        })

        const wrapper = mount(Toast)
        const toastElement = wrapper.find('.bg-red-50')
        expect(toastElement.exists()).toBe(true)
    })
})
