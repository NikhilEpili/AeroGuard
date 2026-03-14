class GraphLoader:
    def load_city_graph(self, city_name: str) -> dict[str, list[dict[str, float | str]]]:
        return {
            "city": city_name,
            "nodes": [],
            "edges": [],
        }
