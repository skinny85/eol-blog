---
id: 5
layout: article.html
title: "'No more loops' - benchmarking the new Java 8 Stream API"
summary: "There was a post on Reddit which advertised using the new features
	introduced in Java 8, like lambda expressions and streams, over traditional
	constructs such as for-loops and collections. I created a benchmark comparing
	the performance of the two approaches."
created_at: 2015-01-14
---

There was a <a href="http://www.deadcoderising.com/java-8-no-more-loops/" target="_blank">link</a> to an interesting blog post recently posted on <a href="http://www.reddit.com/r/programming/comments/2s5gj2/java_8_no_more_loops/" target="_blank">proggit</a>. The article, titled 'Java 8: No more loops', advises eschewing imperative constructs like loops and manipulating collections directly, in favor of functional programming solutions enabled by things like lambda expressions, streams and method references. It illustrates its point by implementing four methods dealing with a simple Article type in two ways: the "old" way by using loops and the "new" way by using the new Java 8 features. In the comments, a lot of people were wondering how does the stream solutions compare in terms of performance to the imperative code. I was kind of wondering that myself, and couldn't recall seeing any benchmark that would directly address the effectiveness of streams. So I wrote one myself.

For convenience, here's the original code (I copied it unchanged):

```
public class Article {
    private final String title;
    private final String author;
    private final List<String> tags;

    public Article(String title, String author, List<String> tags) {
        this.title = title;
        this.author = author;
        this.tags = tags;
    }

    public String getTitle() {
        return title;
    }

    public String getAuthor() {
        return author;
    }

    public List<String> getTags() {
        return tags;
    }
}

public class ArticleOps {
    private final List<Article> articles;

    public ArticleOps(List<Article> articles) {
        this.articles = articles;
    }

    public Article getFirstJavaArticle_loop() {
        for (Article article : articles) {
            if (article.getTags().contains("Java")) {
                return article;
            }
        }
        return null;
    }

    public Optional<Article> getFirstJavaArticle_stream() {
        return articles.stream()
                .filter(article -> article.getTags().contains("Java"))
                .findFirst();
    }

    public List<Article> getAllJavaArticles_loop() {
        List<Article> result = new ArrayList<>();

        for (Article article : articles) {
            if (article.getTags().contains("Java")) {
                result.add(article);
            }
        }

        return result;
    }

    public List<Article> getAllJavaArticles_stream() {
        return articles.stream()
                .filter(article -> article.getTags().contains("Java"))
                .collect(Collectors.toList());
    }

    public Map<String, List<Article>> groupByAuthor_loop() {
        Map<String, List<Article>> result = new HashMap<>();

        for (Article article : articles) {
            if (result.containsKey(article.getAuthor())) {
                result.get(article.getAuthor()).add(article);
            } else {
                ArrayList<Article> articles = new ArrayList<>();
                articles.add(article);
                result.put(article.getAuthor(), articles);
            }
        }

        return result;
    }

    public Map<String, List<Article>> groupByAuthor_stream() {
        return articles.stream()
                .collect(Collectors.groupingBy(Article::getAuthor));
    }

    public Set<String> getDistinctTags_loop() {
        Set<String> result = new HashSet<>();

        for (Article article : articles) {
            result.addAll(article.getTags());
        }

        return result;
    }

    public Set<String> getDistinctTags_stream() {
        return articles.stream()
                .flatMap(article -> article.getTags().stream())
                .collect(Collectors.toSet());
    }
}
```

The code of the benchmark is available on <a href="https://github.com/skinny85/no-more-loops-benchmark" target="_blank">GitHub</a>. It uses the <a href="http://openjdk.java.net/projects/code-tools/jmh/" target="_blank">JMH</a> library. Here are the results on my machine, operating on 10,000 randomly generated Article objects (this is in microseconds per method invocation, so lower is better):

![benchmark graph](/assets/benchmark-graph.png)

As you can see, the results are very close. <code>getAllJavaArticles</code> and <code>groupByAuthor</code> are practically undistinguishably close. Both <code>getFirstJavaArticle</code> and <code>getDistinctTags</code> are faster with for loops - the first one by about 16%, the second around 24%. I should add that I generated the test data purposefully in a way in which there was no Java article, so that both versions of <code>getAllJavaArticles</code> and <code>getFirstJavaArticle</code> had to do their "worst case" (traverse the entire collection).

I think the results are clear - the performance of the Streams API is excellent, in some cases better than a hand-written loop, and not noticably worse in others. Therefore, performance should not be a consideration when choosing between the two styles - rather, readability and ease of maintenance should be the deciding factors.

I encourage you to play with the benchmark yourself. Did your results match mine? Let me know in the comments! Also, this was my first experience writing Java benchmarks - if you have anything to say about that part, I encourage you to give me some feedback, either here or on GitHub.
