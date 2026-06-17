# 增强后的后端代码示例

## 修改说明

为了支持前端轮询时同时获取文件状态，需要增强 `/task/progress/{task_id}` 接口，返回文件的状态信息。

## 完整代码

```python
from fastapi import FastAPI, UploadFile, Form
import asyncio
import json
from concurrent.futures import ThreadPoolExecutor
from typing import Optional

app = FastAPI()

# 全局变量
ORIGIN_FILE = "uploads"
FILE_LIST = "file_list.json"
thread_pool = ThreadPoolExecutor(max_workers=4)
task_progress = {}  # 任务进度字典


async def run_in_thread_pool(func, *args):
    """在线程池中运行同步函数，避免阻塞事件循环"""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(thread_pool, func, *args)


@app.post("/data/upload")
async def upload_file(
        file: UploadFile,
        metadata: str = Form(...)
):
    meta = json.loads(metadata)
    task_id = str(meta["id"])
    file_name = file.filename

    # 保存文件到本地
    content = await file.read()
    with open(f"./{ORIGIN_FILE}/{file_name}", "wb") as f:
        f.write(content)

    # 同步保存元数据
    texts = load_document(f"./{ORIGIN_FILE}/{file_name}")
    chunks = json_text_splitter.split_documents(texts)
    meta["chunkCount"] = len(chunks)
    insrt_write_json(FILE_LIST, meta)

    # 使用线程池异步执行耗时任务
    asyncio.create_task(
        run_in_thread_pool(process_long_task, task_id, file_name, chunks)
    )

    return {
        "code": 200,
        "msg": "上传成功，后台开始处理",
        "data": {
            "task_id": task_id
        }
    }


def process_long_task(task_id, file_name, chunks):
    """处理文档的CPU密集型任务"""
    try:
        print(f"开始处理文档：{file_name}")
        task_progress[task_id] = "开始生成 json 块"

        # 生成 JSON 块
        llm_json = llm_json_process(file_name, chunks, task_id)
        task_progress[task_id] = "生成 json 块完成"

        # 处理 JSON 文档块
        task_progress[task_id] = "处理 json 文档块"
        rest = json_process_list(llm_json, ["topic_index", "topic_type"])
        write_json(f"./{ORIGIN_FILE}/{file_name}.json", rest)
        task_progress[task_id] = "处理 json 文档块完成"
        
        # 更新文件状态：JSON 化完成
        update_file_status(file_name, vectorized=False, jsonCompleted=True)

        # 开始向量化
        task_progress[task_id] = "开始向量化"
        init(f"{file_name}")
        task_progress[task_id] = "向量化完成"
        print("向量化完成")
        
        # 更新文件状态：向量化完成
        update_file_status(file_name, vectorized=True, jsonCompleted=True)

    except Exception as e:
        print(e)
        task_progress[task_id] = f"处理失败: {str(e)}"


def update_file_status(file_name, vectorized=False, jsonCompleted=False):
    """更新文件列表中的状态"""
    try:
        with open(FILE_LIST, 'r', encoding='utf-8') as f:
            files = json.load(f)
        
        # 更新对应文件的状态
        for file in files:
            if file.get("name") == file_name:
                file["vectorized"] = vectorized
                file["jsonCompleted"] = jsonCompleted
                file["progress"] = "完成" if (vectorized and jsonCompleted) else file.get("progress", "")
                break
        
        # 写回文件列表
        with open(FILE_LIST, 'w', encoding='utf-8') as f:
            json.dump(files, f, ensure_ascii=False, indent=2)
            
    except Exception as e:
        print(f"更新文件状态失败: {e}")


@app.get("/task/progress/{task_id}")
def get_progress(task_id: str):
    """
    获取任务进度
    
    返回包含：
    - task_id: 任务ID
    - progress: 进度文本
    - file_status: 文件状态（如果找到）
    """
    # 获取进度文本
    progress_text = task_progress.get(task_id, "未开始")
    
    # 尝试获取文件状态
    file_status = None
    try:
        with open(FILE_LIST, 'r', encoding='utf-8') as f:
            files = json.load(f)
            for file in files:
                if str(file.get("id")) == task_id:
                    file_status = {
                        "vectorized": file.get("vectorized", False),
                        "jsonCompleted": file.get("jsonCompleted", False),
                        "name": file.get("name", "")
                    }
                    break
    except Exception as e:
        print(f"获取文件状态失败: {e}")
    
    return {
        "task_id": task_id,
        "progress": progress_text,
        "file_status": file_status
    }


@app.delete("/file/delete")
async def delete_file(fileName: str = Query(...)):
    """
    删除文件
    """
    try:
        # 1. 删除本地文件
        import os
        file_path = f"./{ORIGIN_FILE}/{fileName}"
        if os.path.exists(file_path):
            os.remove(file_path)
        
        # 2. 删除 JSON 文件（如果存在）
        json_path = f"./{ORIGIN_FILE}/{fileName}.json"
        if os.path.exists(json_path):
            os.remove(json_path)
        
        # 3. 从文件列表中移除
        with open(FILE_LIST, 'r', encoding='utf-8') as f:
            files = json.load(f)
        
        files = [f for f in files if f.get("name") != fileName]
        
        with open(FILE_LIST, 'w', encoding='utf-8') as f:
            json.dump(files, f, ensure_ascii=False, indent=2)
        
        return {
            "code": 200,
            "msg": "删除成功"
        }
    except Exception as e:
        return {
            "code": 500,
            "msg": f"删除失败: {str(e)}"
        }
```

## 关键修改点

### 1. 进度查询接口增强

原来的接口只返回进度文本：
```python
# 旧版本
return {
    "task_id": task_id,
    "progress": task_progress.get(task_id, "未开始")
}
```

现在的接口同时返回文件状态：
```python
# 新版本
return {
    "task_id": task_id,
    "progress": progress_text,
    "file_status": {
        "vectorized": True/False,
        "jsonCompleted": True/False,
        "name": "文件名.pdf"
    }
}
```

### 2. 文件状态更新

在后端处理过程中，适时更新文件状态：
```python
# JSON 化完成后
update_file_status(file_name, vectorized=False, jsonCompleted=True)

# 向量化完成后
update_file_status(file_name, vectorized=True, jsonCompleted=True)
```

### 3. 前端轮询逻辑

前端在轮询时会自动更新文件状态：
```javascript
// 从 result.file_status 中获取文件状态
if (result.file_status) {
    const { vectorized, jsonCompleted } = result.file_status
    // 更新 documentList 中对应文件的状态
    const fileIndex = documentList.value.findIndex(f => f.id === taskId)
    if (fileIndex !== -1) {
        documentList.value[fileIndex] = {
            ...documentList.value[fileIndex],
            vectorized,
            jsonCompleted
        }
    }
}
```

## 工作流程

```
1. 文件上传
   ↓
2. 返回 task_id
   ↓
3. 前端开始轮询 /task/progress/{task_id}
   ↓
4. 后端返回 { progress, file_status }
   ↓
5. 前端更新进度文本和文件状态
   ↓
6. 当 file_status.vectorized && file_status.jsonCompleted 时
   ↓
7. 文件卡片显示完成状态 ✅
```

## 前端文件管理页面会自动更新

当后端更新了文件状态后，前端会在下一次轮询时获取到最新状态，并自动更新：
- ✅ 向量化状态图标
- ✅ JSON 化状态图标
- ✅ 进度条颜色（从蓝色变为绿色）
