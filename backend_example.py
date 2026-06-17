from fastapi import FastAPI, UploadFile, Form
from concurrent.futures import ThreadPoolExecutor
import asyncio
import json

app = FastAPI()

# 创建线程池
thread_pool = ThreadPoolExecutor(max_workers=4)

# 进度存储
task_progress = {}

@app.post("/data/upload")
async def upload_file(
        file: UploadFile,
        metadata: str = Form(...)
):
    # 解析元数据
    meta = json.loads(metadata)
    task_id = str(meta["id"])

    file_name = file.filename

    # 保存文件
    content = await file.read()
    with open(f"./{ORIGIN_FILE}/{file_name}", "wb") as f:
        f.write(content)

    # 保存元数据
    texts = load_document(f"./{ORIGIN_FILE}/{file_name}")
    chunks = json_text_splitter.split_documents(texts)
    meta["chunkCount"] = len(chunks)
    insrt_write_json(FILE_LIST, meta)

    # 异步启动慢任务（使用线程池）
    asyncio.create_task(
        run_in_thread_pool(process_long_task, task_id, file_name, chunks)
    )

    # ✅ 返回 task_id 给前端，前端才能启动轮询
    return {
        "code": 200,
        "msg": "上传成功，后台开始处理",
        "data": {
            "task_id": task_id  # 关键：返回 task_id
        }
    }


async def run_in_thread_pool(func, *args):
    """在线程池中运行同步函数，避免阻塞事件循环"""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(thread_pool, func, *args)


def process_long_task(task_id, file_name, chunks):
    """
    CPU 密集型任务（会在独立线程中执行）
    """
    try:
        print(f"开始处理文档：{file_name}")
        task_progress[task_id] = "开始生成 json 块"
        
        # LLM 处理
        llm_json = llm_json_process(file_name, chunks, task_id)
        task_progress[task_id] = "生成 json 块完成"

        # JSON 处理
        task_progress[task_id] = "处理 json 文档块"
        rest = json_process_list(llm_json, ["topic_index", "topic_type"])
        write_json(f"./{ORIGIN_FILE}/{file_name}.json", rest)
        print("处理 json 文档块完成")
        task_progress[task_id] = "处理 json 文档块完成"

        # 向量化
        task_progress[task_id] = "开始向量化"
        init(f"{file_name}.json")
        task_progress[task_id] = "向量化完成"

    except Exception as e:
        print(f"处理失败: {e}")
        task_progress[task_id] = f"处理失败: {str(e)}"


@app.get("/task/progress/{task_id}")
def get_progress(task_id: str):
    return {
        "task_id": task_id,
        "progress": task_progress.get(task_id, "未开始")
    }
