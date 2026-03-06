import { defineComponent, onMounted } from 'vue'
import { useConnectionStore } from '@stores/connection'
import MainLayout from '@components/layout/MainLayout'

export default defineComponent({
  name: 'App',
  setup() {
    const connectionStore = useConnectionStore()

    onMounted(() => {
      // 初始化时加载已保存的连接
      connectionStore.loadConnections()
    })

    return () => (
      <MainLayout />
    )
  }
})
